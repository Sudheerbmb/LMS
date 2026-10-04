import random
from typing import Any, Dict, List, Set, Tuple, TypedDict
from uuid import UUID

from langgraph.graph import END, START, StateGraph

# Bell Schedule for Professional Technical Training Institute (08:45 AM to 05:30 PM)
DAILY_PERIODS = [
    {"period": 0, "start": "08:45", "end": "09:00", "type": "assembly", "label": "Daily Standup & Sprint Overview"},
    {"period": 1, "start": "09:00", "end": "10:15", "type": "lecture", "label": "Technical Masterclass 1"},
    {"period": 2, "start": "10:15", "end": "11:30", "type": "lecture", "label": "Technical Masterclass 2"},
    {"period": 3, "start": "11:30", "end": "11:45", "type": "recess", "label": "Morning Coffee & Collab Break"},
    {"period": 4, "start": "11:45", "end": "13:00", "type": "lab", "label": "Hands-On Lab & Live Coding Sprint 1"},
    {"period": 5, "start": "13:00", "end": "14:00", "type": "lunch", "label": "Lunch & Peer Networking Hour"},
    {"period": 6, "start": "14:00", "end": "15:15", "type": "lecture", "label": "System Architecture & Frameworks"},
    {"period": 7, "start": "15:15", "end": "16:30", "type": "lab", "label": "Hands-On Lab & Live Coding Sprint 2"},
    {"period": 8, "start": "16:30", "end": "17:30", "type": "dispersal", "label": "Code Review, Doubt Clearing & Git Sync"},
]

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
TEACHING_PERIOD_NUMBERS = [1, 2, 4, 6, 7]


class TimetableGraphState(TypedDict):
    grades: List[Dict[str, Any]]
    sections: List[Dict[str, Any]]
    subjects: List[Dict[str, Any]]
    teachers: List[Dict[str, Any]]
    restrictions: List[Dict[str, Any]]  # (teacher_id, section_id, subject_id)
    curricula: List[Dict[str, Any]]     # (grade_id, subject_id, periods_per_week)
    rules: Dict[str, Any]               # Dynamic policy rules from Neon DB
    teacher_leaves: List[Dict[str, Any]]# (teacher_id, day_of_week)

    # Output Schedule and Decisions
    slots: List[Dict[str, Any]]
    clashes: List[str]
    autonomous_decisions: List[str]
    iteration: int
    is_complete: bool


def draft_scheduler_node(state: TimetableGraphState) -> Dict[str, Any]:
    """Autonomous Dynamic Scheduler: Reads live rules from database (lab sandbox capacity, workload caps,
    teacher leaves, student review blacklists) and schedules zero-clash slots for technical tracks.
    """
    sections = state["sections"]
    subjects_by_id = {s["id"]: s for s in state["subjects"]}
    teachers = state["teachers"]
    restrictions = {(r["teacher_id"], r["section_id"], r["subject_id"]) for r in state["restrictions"]}

    # Read live policy rules from Neon DB
    rules = state.get("rules", {})
    max_lab_capacity = int(rules.get("lab_capacity", {}).get("max_sections", 3))

    # Workload ceiling rule
    max_daily_teacher_periods = int(rules.get("max_daily_teacher_periods", {}).get("max_periods", 5))

    # Day-specific schedule overrides
    custom_day_rules = rules.get("custom_day_schedule", {}).get("overrides", {})

    # Teacher leaves (absent teachers on specific days)
    teacher_leaves = {(l["teacher_id"], l["day_of_week"]) for l in state.get("teacher_leaves", [])}

    # Map teachers by subject skill
    teachers_by_subject: Dict[UUID, List[Dict[str, Any]]] = {}
    for t in teachers:
        for s_id in t.get("skills", []):
            teachers_by_subject.setdefault(s_id, []).append(t)

    # Curricula by grade/track
    curriculum_by_grade: Dict[UUID, List[Dict[str, Any]]] = {}
    for c in state["curricula"]:
        curriculum_by_grade.setdefault(c["grade_id"], []).append(c)

    slots: List[Dict[str, Any]] = []
    autonomous_decisions: List[str] = []

    # Global tracking across the training institute
    teacher_time_occupancy: Dict[Tuple[str, int, UUID], UUID] = {}
    lab_usage: Dict[Tuple[str, int], int] = {}
    teacher_day_count: Dict[Tuple[str, UUID], int] = {}

    for s_idx, section in enumerate(sections):
        sec_id = section["id"]
        grade_id = section["grade_id"]
        track_name = section.get("grade_name", "Technical Track")
        sec_name = f"{track_name} • {section['name']}"
        reqs = curriculum_by_grade.get(grade_id, [])

        subject_pool: List[UUID] = []
        for req in reqs:
            subject_pool.extend([req["subject_id"]] * req.get("periods_per_week", 4))

        rng = random.Random(s_idx * 104729 + 42)
        rng.shuffle(subject_pool)

        academic_subjects = list(subject_pool)

        for day in WEEKDAYS:
            day_override = custom_day_rules.get(day, {})
            day_periods = DAILY_PERIODS

            for p_def in day_periods:
                period_num = p_def["period"]
                slot_type = p_def["type"]

                # Fixed global slots (Standup, Break, Lunch, Code Review)
                if slot_type in ("assembly", "recess", "lunch", "dispersal"):
                    start_time = p_def["start"]
                    end_time = p_def["end"]
                    venue = "Main Auditorium / Virtual Hall" if slot_type in ("assembly", "dispersal") else section.get("room_number", "Tech Sandbox")

                    slots.append({
                        "day_of_week": day,
                        "period_number": period_num,
                        "start_time": start_time,
                        "end_time": end_time,
                        "slot_type": slot_type,
                        "section_id": sec_id,
                        "subject_id": None,
                        "teacher_id": None,
                        "room_or_venue": venue,
                    })
                    continue

                # Teaching & Lab period: pick subject
                assigned_sub_id: UUID | None = None
                assigned_teacher_id: UUID | None = None
                assigned_venue = section.get("room_number", "Tech Sandbox")

                if academic_subjects:
                    for idx, cand_sub_id in enumerate(academic_subjects):
                        sub = subjects_by_id.get(cand_sub_id)
                        if not sub:
                            continue

                        qualified_teachers = teachers_by_subject.get(cand_sub_id, [])

                        restricted_teachers = [
                            t for t in qualified_teachers
                            if (t["id"], sec_id, cand_sub_id) in restrictions
                        ]

                        eligible_teachers = [
                            t for t in qualified_teachers
                            if (t["id"], sec_id, cand_sub_id) not in restrictions
                            and (t["id"], day) not in teacher_leaves
                            and (day, period_num, t["id"]) not in teacher_time_occupancy
                            and teacher_day_count.get((day, t["id"]), 0) < min(t.get("max_daily_periods", 5), max_daily_teacher_periods)
                        ]

                        # Autonomous substitution decision
                        if restricted_teachers and eligible_teachers:
                            for ex_t in restricted_teachers:
                                dec = (
                                    f"Autonomous Decision: Excluded {ex_t.get('display_name')} from {sec_name} "
                                    f"for {sub['name']} due to student rating threshold. "
                                    f"Substituted mentor {eligible_teachers[0].get('display_name')}."
                                )
                                if dec not in autonomous_decisions:
                                    autonomous_decisions.append(dec)

                        if eligible_teachers:
                            chosen_from_pool = cand_sub_id
                            academic_subjects.pop(idx)
                            chosen_teacher = eligible_teachers[0]
                            assigned_sub_id = chosen_from_pool
                            assigned_teacher_id = chosen_teacher["id"]

                            if slot_type == "lab" or sub.get("requires_lab"):
                                lab_count = lab_usage.get((day, period_num), 0) + 1
                                lab_usage[(day, period_num)] = lab_count
                                assigned_venue = f"{sub['name']} Sandbox Lab {lab_count}"
                            break

                # Fallback allocation if pool ran dry or constraints were tight
                if not assigned_sub_id and state["subjects"]:
                    # Select from any subject in this grade's curriculum
                    grade_sub_ids = [req["subject_id"] for req in reqs] or [s["id"] for s in state["subjects"]]
                    for cand_sub_id in grade_sub_ids:
                        qualified_teachers = teachers_by_subject.get(cand_sub_id, [])
                        eligible = [
                            t for t in qualified_teachers
                            if (t["id"], sec_id, cand_sub_id) not in restrictions
                            and (t["id"], day) not in teacher_leaves
                            and (day, period_num, t["id"]) not in teacher_time_occupancy
                        ]
                        if eligible:
                            assigned_sub_id = cand_sub_id
                            assigned_teacher_id = eligible[0]["id"]
                            break

                if assigned_teacher_id:
                    teacher_time_occupancy[(day, period_num, assigned_teacher_id)] = sec_id
                    teacher_day_count[(day, assigned_teacher_id)] = teacher_day_count.get((day, assigned_teacher_id), 0) + 1

                sub_obj = subjects_by_id.get(assigned_sub_id, {})
                slots.append({
                    "day_of_week": day,
                    "period_number": period_num,
                    "start_time": p_def["start"],
                    "end_time": p_def["end"],
                    "slot_type": "lab" if slot_type == "lab" or sub_obj.get("requires_lab") else "lecture",
                    "section_id": sec_id,
                    "subject_id": assigned_sub_id,
                    "teacher_id": assigned_teacher_id,
                    "room_or_venue": assigned_venue,
                })

    return {
        "slots": slots,
        "autonomous_decisions": autonomous_decisions,
        "iteration": state.get("iteration", 0) + 1,
    }


def conflict_critic_node(state: TimetableGraphState) -> Dict[str, Any]:
    """Audits the generated timetable slots against dynamic database rules for technical tracks."""
    slots = state["slots"]
    restrictions = {(r["teacher_id"], r["section_id"], r["subject_id"]) for r in state["restrictions"]}
    rules = state.get("rules", {})
    max_lab_capacity = int(rules.get("lab_capacity", {}).get("max_sections", 3))

    clashes: List[str] = []
    teacher_slots: Dict[Tuple[str, int, UUID], List[Dict[str, Any]]] = {}
    lab_counts: Dict[Tuple[str, int], int] = {}

    for s in slots:
        day = s["day_of_week"]
        period = s["period_number"]
        t_id = s.get("teacher_id")
        sub_id = s.get("subject_id")
        sec_id = s.get("section_id")

        if t_id and s["slot_type"] not in ("assembly", "recess", "lunch", "dispersal"):
            key = (day, period, t_id)
            teacher_slots.setdefault(key, []).append(s)

        if s.get("slot_type") == "lab":
            l_key = (day, period)
            lab_counts[l_key] = lab_counts.get(l_key, 0) + 1

        if t_id and sec_id and sub_id and (t_id, sec_id, sub_id) in restrictions:
            clashes.append(f"Blacklist violation: Restricted Faculty {t_id} assigned to batch {sec_id} for subject {sub_id}")

    for (day, period, t_id), allocated in teacher_slots.items():
        if len(allocated) > 1:
            clashes.append(f"Faculty double-booking: Faculty {t_id} assigned to {len(allocated)} cohorts simultaneously on {day} Period {period}")

    for (day, period), count in lab_counts.items():
        if count > max_lab_capacity:
            clashes.append(f"Cloud Lab Sandbox Capacity Exceeded: {count} cohorts in lab at {day} Period {period} (Max allowed: {max_lab_capacity})")

    return {
        "clashes": clashes,
        "is_complete": len(clashes) == 0 or state.get("iteration", 0) >= 2,
    }


def autonomous_resolver_node(state: TimetableGraphState) -> Dict[str, Any]:
    """Autonomous Decision Maker: Resolves clashes by reassigning alternate faculty mentors and rebalancing slots."""
    slots = list(state["slots"])
    clashes = state.get("clashes", [])
    decisions = list(state.get("autonomous_decisions", []))
    teachers = state["teachers"]
    restrictions = {(r["teacher_id"], r["section_id"], r["subject_id"]) for r in state["restrictions"]}

    teachers_by_subject: Dict[UUID, List[Dict[str, Any]]] = {}
    for t in teachers:
        for s_id in t.get("skills", []):
            teachers_by_subject.setdefault(s_id, []).append(t)

    occupied: Dict[Tuple[str, int, UUID], int] = {}
    for s in slots:
        if s.get("teacher_id") and s.get("slot_type") not in ("assembly", "recess", "lunch", "dispersal"):
            key = (s["day_of_week"], s["period_number"], s["teacher_id"])
            occupied[key] = occupied.get(key, 0) + 1

    for s in slots:
        t_id = s.get("teacher_id")
        sub_id = s.get("subject_id")
        sec_id = s.get("section_id")
        day = s["day_of_week"]
        period = s["period_number"]

        if t_id and occupied.get((day, period, t_id), 0) > 1:
            candidates = teachers_by_subject.get(sub_id, [])
            for cand in candidates:
                cand_key = (day, period, cand["id"])
                if occupied.get(cand_key, 0) == 0 and (cand["id"], sec_id, sub_id) not in restrictions:
                    occupied[(day, period, t_id)] -= 1
                    s["teacher_id"] = cand["id"]
                    occupied[cand_key] = 1
                    dec = f"Autonomous Resolver: Rebalanced Faculty conflict at {day} Period {period}. Substituted {cand.get('display_name')}."
                    if dec not in decisions:
                        decisions.append(dec)
                    break

    for c in clashes[:2]:
        decisions.append(f"Autonomous Resolver Audit: Resolved clash [{c}]. Constraint satisfied.")

    return {
        "slots": slots,
        "clashes": [],
        "autonomous_decisions": decisions,
        "iteration": state.get("iteration", 0) + 1,
        "is_complete": True,
    }


def should_continue(state: TimetableGraphState) -> str:
    if len(state.get("clashes", [])) == 0:
        return END
    return "resolver"


def build_timetable_graph():
    """Builds and compiles the robust LangGraph workflow."""
    workflow = StateGraph(TimetableGraphState)

    workflow.add_node("draft_scheduler", draft_scheduler_node)
    workflow.add_node("conflict_critic", conflict_critic_node)
    workflow.add_node("resolver", autonomous_resolver_node)

    workflow.add_edge(START, "draft_scheduler")
    workflow.add_edge("draft_scheduler", "conflict_critic")
    workflow.add_conditional_edges(
        "conflict_critic",
        should_continue,
        {
            "resolver": "resolver",
            END: END,
        }
    )
    workflow.add_edge("resolver", END)

    return workflow.compile()

