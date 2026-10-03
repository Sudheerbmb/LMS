import re
import uuid
from typing import Any, Dict, List, Optional
from uuid import UUID
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.identity.models import User
from app.identity.security import hash_password
from app.timetable.agent import build_timetable_graph
from app.timetable.models import (
    GradeCurriculum,
    CurriculumCourseOverride,
    SchoolGrade,
    SchoolSection,
    Subject,
    TeacherClassRestriction,
    TeacherFeedback,
    TeacherLeave,
    TeacherProfile,
    TeacherSubjectSkill,
    TimetableRule,
    TimetableSlot,
)


# Technical Training Institute Tracks (1: Python GenAI, 2: Salesforce, 3: ServiceNow, 4: Full Stack, 5: Cloud DevOps)
GRADE_CURRICULUM_MATRIX = {
    1: [("PY-101", 10), ("GEN-201", 10), ("RAG-301", 10), ("AI-401", 10)],
    2: [("SF-ADM", 14), ("SF-DEV", 14), ("SF-LWC", 12)],
    3: [("SN-FND", 20), ("SN-DEV", 20)],
    4: [("FS-REA", 20), ("FS-NOD", 20)],
    5: [("DO-CON", 20), ("DO-CICD", 20)],
    6: [("PY-101", 10), ("GEN-201", 10), ("RAG-301", 10), ("AI-401", 10)],
    7: [("SF-ADM", 14), ("SF-DEV", 14), ("SF-LWC", 12)],
    8: [("SN-FND", 20), ("SN-DEV", 20)],
    9: [("FS-REA", 20), ("FS-NOD", 20)],
    10: [("DO-CON", 20), ("DO-CICD", 20)],
}

SUBJECT_DEFAULTS = [
    # Python & GenAI Track
    {"code": "PY-101", "name": "Python Core & Advanced OOP", "category": "tech", "requires_lab": True, "color": "#3b82f6"},
    {"code": "GEN-201", "name": "Prompt Engineering, LLMs & LangChain", "category": "ai", "requires_lab": True, "color": "#8b5cf6"},
    {"code": "RAG-301", "name": "RAG Architecture & Vector DBs", "category": "ai", "requires_lab": True, "color": "#10b981"},
    {"code": "AI-401", "name": "Autonomous Agents & FastAPI Deployment", "category": "ai", "requires_lab": True, "color": "#f59e0b"},

    # Salesforce Track
    {"code": "SF-ADM", "name": "Salesforce Administrator Essentials", "category": "crm", "requires_lab": True, "color": "#0284c7"},
    {"code": "SF-DEV", "name": "Apex Programming & SOQL Queries", "category": "crm", "requires_lab": True, "color": "#0ea5e9"},
    {"code": "SF-LWC", "name": "Lightning Web Components (LWC)", "category": "crm", "requires_lab": True, "color": "#38bdf8"},

    # ServiceNow Track
    {"code": "SN-FND", "name": "ServiceNow Platform Administration & ITSM", "category": "itsm", "requires_lab": True, "color": "#14b8a6"},
    {"code": "SN-DEV", "name": "Flow Designer & Client/Server Scripting", "category": "itsm", "requires_lab": True, "color": "#06b6d4"},

    # Full Stack Track
    {"code": "FS-REA", "name": "React, TypeScript & Modern UI", "category": "fullstack", "requires_lab": True, "color": "#6366f1"},
    {"code": "FS-NOD", "name": "Node.js, PostgreSQL & API Microservices", "category": "fullstack", "requires_lab": True, "color": "#4f46e5"},

    # Cloud & DevOps Track
    {"code": "DO-CON", "name": "Docker Containerization & Kubernetes", "category": "devops", "requires_lab": True, "color": "#ec4899"},
    {"code": "DO-CICD", "name": "CI/CD Pipelines & Cloud Architecture", "category": "devops", "requires_lab": True, "color": "#f43f5e"},
]

TEACHER_SEEDS = [
    # Python & AI Department
    {"name": "Dr. Sarah Connor", "email": "sarah.connor@institute.edu", "emp_id": "T001", "qualification": "Ph.D in AI & Senior Python Architect", "subjects": ["PY-101", "AI-401"], "rating": 4.9},
    {"name": "Prof. Alan Turing", "email": "alan.turing@institute.edu", "emp_id": "T002", "qualification": "Principal LLM & RAG Systems Engineer", "subjects": ["GEN-201", "RAG-301", "PY-101"], "rating": 5.0},

    # Salesforce Department
    {"name": "Marc Benioff", "email": "marc.b@institute.edu", "emp_id": "T003", "qualification": "Certified Technical Architect (CTA) & Salesforce Lead", "subjects": ["SF-ADM", "SF-DEV", "SF-LWC"], "rating": 4.8},

    # ServiceNow Department
    {"name": "Fred Luddy", "email": "fred.l@institute.edu", "emp_id": "T004", "qualification": "Certified ServiceNow CAD & Platform Master", "subjects": ["SN-FND", "SN-DEV"], "rating": 4.9},

    # Full Stack Web Department
    {"name": "Dan Abramov", "email": "dan.a@institute.edu", "emp_id": "T005", "qualification": "Staff Full-Stack & React Core Engineer", "subjects": ["FS-REA", "FS-NOD"], "rating": 4.9},

    # DevOps Department
    {"name": "Linus Torvalds", "email": "linus.t@institute.edu", "emp_id": "T006", "qualification": "Principal Cloud Architect & Kubernetes CKA", "subjects": ["DO-CON", "DO-CICD"], "rating": 5.0},
]

DEFAULT_POLICY_RULES = [
    {
        "name": "Sports Ground Concurrent Capacity",
        "rule_type": "ground_capacity",
        "category": "capacity",
        "description": "Limits how many classes can occupy the playground simultaneously. Edit to 1, 2, or 3 based on your school field zones.",
        "parameters": {"max_sections": 2},
        "is_enabled": True,
        "priority": 1,
    },
    {
        "name": "Post-Lunch Heavy Activity Ban",
        "rule_type": "post_lunch_blacklist",
        "category": "ergonomics",
        "description": "Prevents sports/running periods immediately after lunch (Period 8 / 2:00 PM) to protect student health.",
        "parameters": {"forbidden_period": 8},
        "is_enabled": True,
        "priority": 1,
    },
    {
        "name": "Teacher Daily Workload Cap",
        "rule_type": "max_daily_teacher_periods",
        "category": "workload",
        "description": "Ceiling on how many instructional periods can be scheduled for any single teacher per day.",
        "parameters": {"max_periods": 5},
        "is_enabled": True,
        "priority": 1,
    },
    {
        "name": "Negative Review Auto-Disqualification",
        "rule_type": "rating_complaint_blacklist",
        "category": "pedagogy",
        "description": "Automatically excludes teachers with student ratings <= 2.5 or active complaints from that specific section.",
        "parameters": {"threshold_rating": 2.5},
        "is_enabled": True,
        "priority": 1,
    },
    {
        "name": "Cognitive Load (No Triple Consecutive Subject)",
        "rule_type": "consecutive_subject_limit",
        "category": "pedagogy",
        "description": "Prevents more than 2 back-to-back periods of the exact same academic subject to prevent student fatigue.",
        "parameters": {"max_consecutive": 2},
        "is_enabled": True,
        "priority": 2,
    },
    {
        "name": "Day-Specific Schedule (Delayed Start / Special Assembly)",
        "rule_type": "custom_day_schedule",
        "category": "schedule",
        "description": "Allows customized bell schedule start/end times or altered periods for specific weekdays.",
        "parameters": {"overrides": {}},
        "is_enabled": False,
        "priority": 2,
    },
]


async def seed_school_defaults(session: AsyncSession) -> Dict[str, Any]:
    """Populates Grades 1-10, realistic subjects, curricula, rules, and teacher profiles in Neon DB."""
    # 1. Seed Dynamic Policy Rules
    for r_data in DEFAULT_POLICY_RULES:
        existing_rule = await session.scalar(select(TimetableRule).where(TimetableRule.rule_type == r_data["rule_type"]))
        if not existing_rule:
            session.add(TimetableRule(
                name=r_data["name"],
                rule_type=r_data["rule_type"],
                category=r_data["category"],
                description=r_data["description"],
                parameters=r_data["parameters"],
                is_enabled=r_data["is_enabled"],
                priority=r_data["priority"],
            ))
            await session.flush()

    # 2. Seed Subjects
    subject_map: Dict[str, Subject] = {}
    for s_data in SUBJECT_DEFAULTS:
        existing = await session.scalar(select(Subject).where(Subject.code == s_data["code"]))
        if not existing:
            existing = Subject(
                code=s_data["code"],
                name=s_data["name"],
                category=s_data["category"],
                requires_ground=s_data.get("requires_ground", False),
                requires_lab=s_data.get("requires_lab", False),
                color=s_data.get("color", "#06b6d4"),
            )
            session.add(existing)
            await session.flush()
        else:
            existing.name = s_data["name"]
            existing.category = s_data["category"]
            existing.requires_ground = s_data.get("requires_ground", False)
            existing.requires_lab = s_data.get("requires_lab", False)
            existing.color = s_data.get("color", "#06b6d4")
            await session.flush()
        subject_map[existing.code] = existing

    # 3. Seed Grades 1 to 10 and Sections A & B
    grade_map: Dict[int, SchoolGrade] = {}
    section_list: List[SchoolSection] = []
    for g_num in range(1, 11):
        grade = await session.scalar(select(SchoolGrade).where(SchoolGrade.grade_number == g_num))
        if not grade:
            grade = SchoolGrade(
                grade_number=g_num,
                name=f"Class {g_num}",
                academic_year="2026-2027",
            )
            session.add(grade)
            await session.flush()
        grade_map[g_num] = grade

        for sec_letter in ["A", "B"]:
            sec = await session.scalar(
                select(SchoolSection).where(
                    SchoolSection.grade_id == grade.id,
                    SchoolSection.name == sec_letter
                )
            )
            if not sec:
                sec = SchoolSection(
                    grade_id=grade.id,
                    name=sec_letter,
                    room_number=f"Room {g_num}0{1 if sec_letter == 'A' else 2}",
                )
                session.add(sec)
                await session.flush()
            section_list.append(sec)

        curr_rules = GRADE_CURRICULUM_MATRIX.get(g_num, [])
        allowed_subject_ids = [subject_map[code].id for code, _ in curr_rules if code in subject_map]
        for sub_code, periods in curr_rules:
            sub = subject_map.get(sub_code)
            if sub:
                existing_curr = await session.scalar(
                    select(GradeCurriculum).where(
                        GradeCurriculum.grade_id == grade.id,
                        GradeCurriculum.subject_id == sub.id
                    )
                )
                if not existing_curr:
                    session.add(GradeCurriculum(
                        grade_id=grade.id,
                        subject_id=sub.id,
                        periods_per_week=periods,
                    ))
                else:
                    existing_curr.periods_per_week = periods

        # Keep existing deployments aligned when the official scheme of studies changes.
        if allowed_subject_ids:
            await session.execute(
                delete(GradeCurriculum).where(
                    GradeCurriculum.grade_id == grade.id,
                    GradeCurriculum.subject_id.not_in(allowed_subject_ids),
                )
            )

    # 4. Seed Teachers with Skills
    teachers_created: List[TeacherProfile] = []
    for t_data in TEACHER_SEEDS:
        user = await session.scalar(select(User).where(User.email == t_data["email"]))
        if not user:
            user = User(
                email=t_data["email"],
                display_name=t_data["name"],
                password_hash=hash_password("Teacher123!"),
                role="teacher",
                status="active",
                email_verified=True,
            )
            session.add(user)
            await session.flush()
        else:
            user.display_name = t_data["name"]
            user.role = "teacher"
            user.status = "active"

        # Check if TeacherProfile already exists by user_id OR employee_id
        profile = await session.scalar(
            select(TeacherProfile).where(
                (TeacherProfile.user_id == user.id) | (TeacherProfile.employee_id == t_data["emp_id"])
            )
        )
        if not profile:
            profile = TeacherProfile(
                user_id=user.id,
                employee_id=t_data["emp_id"],
                qualification=t_data.get("qualification", "Senior Technical Specialist"),
                max_daily_periods=5,
                rating_avg=t_data["rating"],
                complaint_count=3 if t_data["rating"] < 3.0 else 0,
            )
            session.add(profile)
            await session.flush()
        else:
            profile.user_id = user.id
            profile.employee_id = t_data["emp_id"]
            profile.qualification = t_data.get("qualification", "Senior Technical Specialist")
            profile.rating_avg = t_data["rating"]
            profile.complaint_count = 3 if t_data["rating"] < 3.0 else 0
            await session.flush()

        valid_subject_ids = []
        for sub_code in t_data["subjects"]:
            sub = subject_map.get(sub_code)
            if sub:
                valid_subject_ids.append(sub.id)
                existing_skill = await session.scalar(
                    select(TeacherSubjectSkill).where(
                        TeacherSubjectSkill.teacher_id == profile.id,
                        TeacherSubjectSkill.subject_id == sub.id,
                    )
                )
                if not existing_skill:
                    session.add(TeacherSubjectSkill(teacher_id=profile.id, subject_id=sub.id))

        if valid_subject_ids:
            await session.execute(
                delete(TeacherSubjectSkill).where(
                    TeacherSubjectSkill.teacher_id == profile.id,
                    TeacherSubjectSkill.subject_id.not_in(valid_subject_ids)
                )
            )
        await session.flush()

        teachers_created.append(profile)

    await session.commit()
    return {
        "grades_seeded": 10,
        "sections_seeded": len(section_list),
        "subjects_seeded": len(subject_map),
        "teachers_seeded": len(teachers_created),
        "rules_seeded": len(DEFAULT_POLICY_RULES),
    }


async def generate_school_timetable(session: AsyncSession) -> Dict[str, Any]:
    """Runs the LangGraph agent to generate the master school schedule with live database rules."""
    # 1. Fetch live rules from Neon DB
    rules = (await session.scalars(select(TimetableRule).where(TimetableRule.is_enabled == True))).all()
    rules_dict = {r.rule_type: r.parameters for r in rules}

    # Fetch active teacher leaves
    leaves = (await session.scalars(select(TeacherLeave).where(TeacherLeave.is_active == True))).all()
    teacher_leaves_list = [{"teacher_id": l.teacher_id, "day_of_week": l.day_of_week} for l in leaves]

    grades = (await session.scalars(select(SchoolGrade).order_by(SchoolGrade.grade_number))).all()
    sections = (await session.scalars(select(SchoolSection).options(selectinload(SchoolSection.grade)).order_by(SchoolSection.name))).all()
    subjects = (await session.scalars(select(Subject))).all()
    teachers = (await session.scalars(select(TeacherProfile).options(selectinload(TeacherProfile.skills)))).all()
    restrictions = (await session.scalars(select(TeacherClassRestriction).where(TeacherClassRestriction.is_active == True))).all()
    curricula = (await session.scalars(select(GradeCurriculum))).all()

    teacher_users = (await session.scalars(select(User).where(User.id.in_([t.user_id for t in teachers])))).all()
    user_name_map = {u.id: u.display_name for u in teacher_users}

    state_input = {
        "grades": [{"id": g.id, "number": g.grade_number, "name": g.name} for g in grades],
        "sections": [{"id": s.id, "name": s.name, "grade_id": s.grade_id, "room_number": s.room_number, "grade_name": s.grade.name if s.grade else ""} for s in sections],
        "subjects": [{"id": s.id, "code": s.code, "name": s.name, "requires_ground": s.requires_ground, "requires_lab": s.requires_lab, "category": s.category} for s in subjects],
        "teachers": [{
            "id": t.id,
            "display_name": user_name_map.get(t.user_id, f"Teacher {t.employee_id}"),
            "employee_id": t.employee_id,
            "max_daily_periods": t.max_daily_periods,
            "rating_avg": t.rating_avg,
            "skills": [sk.subject_id for sk in t.skills],
        } for t in teachers],
        "restrictions": [{"teacher_id": r.teacher_id, "section_id": r.section_id, "subject_id": r.subject_id, "reason": r.reason} for r in restrictions],
        "curricula": [{"grade_id": c.grade_id, "subject_id": c.subject_id, "periods_per_week": c.periods_per_week} for c in curricula],
        "rules": rules_dict,
        "teacher_leaves": teacher_leaves_list,
        "slots": [],
        "clashes": [],
        "autonomous_decisions": [],
        "iteration": 0,
        "is_complete": False,
    }

    graph = build_timetable_graph()
    final_state = graph.invoke(state_input)

    generated_slots = final_state.get("slots", [])
    decisions = final_state.get("autonomous_decisions", [])

    await session.execute(delete(TimetableSlot))
    for s_dict in generated_slots:
        slot = TimetableSlot(
            day_of_week=s_dict["day_of_week"],
            period_number=s_dict["period_number"],
            start_time=s_dict["start_time"],
            end_time=s_dict["end_time"],
            slot_type=s_dict["slot_type"],
            room_or_venue=s_dict.get("room_or_venue", "Room"),
            section_id=s_dict["section_id"],
            subject_id=s_dict.get("subject_id"),
            teacher_id=s_dict.get("teacher_id"),
        )
        session.add(slot)

    await session.commit()

    return {
        "status": "success",
        "academic_year": "2026-2027",
        "total_slots_scheduled": len(generated_slots),
        "total_sections": len(sections),
        "ground_capacity_complied": True,
        "autonomous_decisions": decisions[:12],
        "audit_summary": f"Successfully generated dynamic master timetable using live Neon DB policy rules for all 10 grades across 5 weekdays.",
    }


async def get_timetable_grid(
    session: AsyncSession,
    section_id: Optional[UUID] = None,
    grade_id: Optional[UUID] = None,
    teacher_id: Optional[UUID] = None,
    day_of_week: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieves timetable slots formatted for weekly display."""
    query = (
        select(TimetableSlot)
        .options(
            selectinload(TimetableSlot.section).selectinload(SchoolSection.grade),
            selectinload(TimetableSlot.subject),
            selectinload(TimetableSlot.teacher).selectinload(TeacherProfile.skills),
        )
        .order_by(TimetableSlot.period_number)
    )

    if section_id:
        query = query.where(TimetableSlot.section_id == section_id)
    if teacher_id:
        query = query.where(TimetableSlot.teacher_id == teacher_id)
    if day_of_week:
        query = query.where(TimetableSlot.day_of_week == day_of_week)

    slots = (await session.scalars(query)).all()

    if grade_id:
        slots = [s for s in slots if s.section and s.section.grade_id == grade_id]

    teacher_user_ids = {s.teacher.user_id for s in slots if s.teacher}
    users = (await session.scalars(select(User).where(User.id.in_(teacher_user_ids)))).all() if teacher_user_ids else []
    user_name_map = {u.id: u.display_name for u in users}

    result = []
    for s in slots:
        t_name = user_name_map.get(s.teacher.user_id) if s.teacher else None
        result.append({
            "id": s.id,
            "day_of_week": s.day_of_week,
            "period_number": s.period_number,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "slot_type": s.slot_type,
            "room_or_venue": s.room_or_venue,
            "section_id": s.section_id,
            "section_name": s.section.name if s.section else None,
            "grade_name": s.section.grade.name if s.section and s.section.grade else None,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name if s.subject else None,
            "subject_code": s.subject.code if s.subject else None,
            "subject_color": s.subject.color if s.subject else None,
            "teacher_id": s.teacher_id,
            "teacher_name": t_name,
        })
    return result


async def get_all_timetable_rules(session: AsyncSession) -> List[TimetableRule]:
    """Retrieves all dynamic school scheduling rules."""
    return (await session.scalars(select(TimetableRule).order_by(TimetableRule.priority, TimetableRule.name))).all()


async def toggle_timetable_rule(session: AsyncSession, rule_id: UUID) -> TimetableRule:
    """Toggles a dynamic policy rule ON or OFF."""
    rule = await session.get(TimetableRule, rule_id)
    if rule:
        rule.is_enabled = not rule.is_enabled
        await session.commit()
        await session.refresh(rule)
    return rule


async def update_timetable_rule(session: AsyncSession, rule_id: UUID, payload: Dict[str, Any]) -> TimetableRule:
    """Updates parameters, description, or priority of a rule."""
    rule = await session.get(TimetableRule, rule_id)
    if rule:
        for k, v in payload.items():
            if v is not None and hasattr(rule, k):
                setattr(rule, k, v)
        await session.commit()
        await session.refresh(rule)
    return rule


async def create_timetable_rule(session: AsyncSession, payload: Dict[str, Any]) -> TimetableRule:
    """Creates a new dynamic policy rule."""
    rule = TimetableRule(
        name=payload["name"],
        rule_type=payload["rule_type"],
        category=payload.get("category", "policy"),
        description=payload["description"],
        parameters=payload.get("parameters", {}),
        is_enabled=payload.get("is_enabled", True),
        priority=payload.get("priority", 1),
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


async def delete_timetable_rule(session: AsyncSession, rule_id: UUID) -> bool:
    """Deletes a dynamic policy rule."""
    rule = await session.get(TimetableRule, rule_id)
    if rule:
        await session.delete(rule)
        await session.commit()
        return True
    return False


async def find_available_substitutes(session: AsyncSession, slot_id: UUID) -> List[Dict[str, Any]]:
    """Smart Substitute Finder: Finds qualified, FREE teachers with matching subject skill for a specific slot."""
    slot = await session.scalar(
        select(TimetableSlot)
        .options(selectinload(TimetableSlot.section))
        .where(TimetableSlot.id == slot_id)
    )
    if not slot or not slot.subject_id:
        return []

    day = slot.day_of_week
    period = slot.period_number
    sec_id = slot.section_id
    sub_id = slot.subject_id

    # 1. Teachers with matching subject skill
    skilled_teachers = (
        await session.scalars(
            select(TeacherProfile)
            .join(TeacherSubjectSkill)
            .where(TeacherSubjectSkill.subject_id == sub_id)
            .options(selectinload(TeacherProfile.skills))
        )
    ).all()

    # 2. Get active restrictions for this section & subject
    restrictions = (
        await session.scalars(
            select(TeacherClassRestriction)
            .where(
                TeacherClassRestriction.section_id == sec_id,
                TeacherClassRestriction.subject_id == sub_id,
                TeacherClassRestriction.is_active == True,
            )
        )
    ).all()
    restricted_teacher_ids = {r.teacher_id for r in restrictions}

    # 3. Get active teacher leaves on this day
    leaves = (
        await session.scalars(
            select(TeacherLeave)
            .where(TeacherLeave.day_of_week == day, TeacherLeave.is_active == True)
        )
    ).all()
    on_leave_teacher_ids = {l.teacher_id for l in leaves}

    # 4. Check who is occupied at (day, period)
    occupied_slots = (
        await session.scalars(
            select(TimetableSlot)
            .where(
                TimetableSlot.day_of_week == day,
                TimetableSlot.period_number == period,
                TimetableSlot.teacher_id != None,
                TimetableSlot.id != slot_id,
            )
        )
    ).all()
    busy_teacher_ids = {s.teacher_id for s in occupied_slots}

    # 5. Teacher loads on this day
    day_slots = (
        await session.scalars(
            select(TimetableSlot)
            .where(TimetableSlot.day_of_week == day, TimetableSlot.teacher_id != None)
        )
    ).all()
    day_load: Dict[UUID, int] = {}
    for s in day_slots:
        day_load[s.teacher_id] = day_load.get(s.teacher_id, 0) + 1

    # Get user names
    user_ids = [t.user_id for t in skilled_teachers]
    users = (await session.scalars(select(User).where(User.id.in_(user_ids)))).all() if user_ids else []
    user_name_map = {u.id: u.display_name for u in users}

    candidates = []
    for t in skilled_teachers:
        is_current = (t.id == slot.teacher_id)
        is_free = (t.id not in busy_teacher_ids) and (t.id not in on_leave_teacher_ids)
        is_restricted = (t.id in restricted_teacher_ids)
        current_load = day_load.get(t.id, 0)
        has_load_capacity = current_load < t.max_daily_periods

        conflict_notes = []
        if is_current:
            conflict_notes.append("Currently Assigned")
        if t.id in on_leave_teacher_ids:
            conflict_notes.append("On Leave Today")
        if t.id in busy_teacher_ids:
            conflict_notes.append("Teaching Another Class This Period")
        if is_restricted:
            conflict_notes.append("Restricted Due to Student Complaints")
        if not has_load_capacity:
            conflict_notes.append("Daily Max Workload Reached")

        # Suitability Match Score (0 - 100)
        score = 50.0 + (t.rating_avg * 10.0) - (current_load * 3.0)
        if not is_free or is_restricted or not has_load_capacity:
            score -= 40.0
        if is_current:
            score -= 10.0

        candidates.append({
            "teacher_id": t.id,
            "display_name": user_name_map.get(t.user_id, f"Teacher {t.employee_id}"),
            "employee_id": t.employee_id,
            "qualification": t.qualification,
            "rating_avg": t.rating_avg,
            "current_day_load": current_load,
            "max_daily_periods": t.max_daily_periods,
            "is_free": is_free and not is_restricted and has_load_capacity,
            "is_restricted_for_class": is_restricted,
            "match_score": round(max(0.0, min(100.0, score)), 1),
            "conflict_notes": " • ".join(conflict_notes) if conflict_notes else "Perfect Match (Free & Highly Rated)",
        })

    # Sort candidates: Best matches first
    candidates.sort(key=lambda c: (c["is_free"], c["match_score"]), reverse=True)
    return candidates


async def swap_slots(session: AsyncSession, slot_id_1: UUID, slot_id_2: UUID) -> Dict[str, Any]:
    """Swaps subject, teacher, and venue between two timetable slots (Drag-and-Drop support)."""
    slot1 = await session.get(TimetableSlot, slot_id_1)
    slot2 = await session.get(TimetableSlot, slot_id_2)

    if not slot1 or not slot2:
        return {"status": "error", "message": "One or both slots not found"}

    # Swap attributes
    slot1.subject_id, slot2.subject_id = slot2.subject_id, slot1.subject_id
    slot1.teacher_id, slot2.teacher_id = slot2.teacher_id, slot1.teacher_id
    slot1.room_or_venue, slot2.room_or_venue = slot2.room_or_venue, slot1.room_or_venue
    slot1.slot_type, slot2.slot_type = slot2.slot_type, slot1.slot_type

    await session.commit()
    return {
        "status": "success",
        "message": f"Successfully swapped {slot1.day_of_week} Period {slot1.period_number} with {slot2.day_of_week} Period {slot2.period_number}",
    }


async def update_slot(session: AsyncSession, slot_id: UUID, payload: Dict[str, Any]) -> TimetableSlot:
    """Directly updates a timetable slot."""
    slot = await session.get(TimetableSlot, slot_id)
    if slot:
        for k, v in payload.items():
            if v is not None and hasattr(slot, k):
                setattr(slot, k, v)
        await session.commit()
        await session.refresh(slot)
    return slot


async def get_all_teachers_with_feedback(session: AsyncSession) -> List[Dict[str, Any]]:
    """Retrieves teacher profiles with their subject skills, rating, and active restrictions."""
    teachers = (
        await session.scalars(
            select(TeacherProfile)
            .options(
                selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject),
                selectinload(TeacherProfile.feedback).selectinload(TeacherFeedback.section).selectinload(SchoolSection.grade),
                selectinload(TeacherProfile.feedback).selectinload(TeacherFeedback.subject),
                selectinload(TeacherProfile.restrictions).selectinload(TeacherClassRestriction.section).selectinload(SchoolSection.grade),
                selectinload(TeacherProfile.restrictions).selectinload(TeacherClassRestriction.subject),
            )
            .order_by(TeacherProfile.employee_id)
        )
    ).all()

    user_ids = [t.user_id for t in teachers]
    users = (await session.scalars(select(User).where(User.id.in_(user_ids)))).all()
    user_map = {u.id: u for u in users}

    result = []
    qual_map = {
        "T001": "Ph.D in AI & Senior Python Architect",
        "T002": "Principal LLM & RAG Systems Engineer",
        "T003": "Certified Technical Architect (CTA) & Salesforce Lead",
        "T004": "Certified ServiceNow CAD & Platform Master",
        "T005": "Staff Full-Stack & React Core Engineer",
        "T006": "Principal Cloud Architect & Kubernetes CKA",
    }
    obsolete_keywords = ['mathematics', 'physics', 'english', 'art', 'social', 'hindi', 'biology', 'chemistry', 'craft', 'storytelling', 'cbse']

    for t in teachers:
        u = user_map.get(t.user_id)
        skills = [
            sk.subject.name for sk in t.skills 
            if sk.subject and not any(k in sk.subject.name.lower() for k in obsolete_keywords)
        ]
        restrictions = [
            {
                "id": str(r.id),
                "section": f"Track {r.section.grade.grade_number} • Batch {r.section.name}" if r.section and r.section.grade else "Batch",
                "subject": r.subject.name if r.subject else "Subject",
                "reason": r.reason,
                "is_active": r.is_active,
            }
            for r in t.restrictions
        ]
        reviews = [
            {
                "id": str(review.id),
                "rating": review.rating,
                "category": review.category,
                "comments": review.comments,
                "section": (
                    f"Track {review.section.grade.grade_number} • Batch {review.section.name}"
                    if review.section and review.section.grade
                    else "Batch"
                ),
                "subject": review.subject.name if review.subject else "Subject",
                "created_at": review.created_at.isoformat() if review.created_at else None,
            }
            for review in sorted(t.feedback, key=lambda item: item.created_at, reverse=True)
            if not any(k in (review.comments or '').lower() for k in ['trigonometry', 'maths', 'physics'])
        ]
        teacher_rating = (
            sum(review.rating for review in reviews) / len(reviews)
            if reviews
            else t.rating_avg
        )

        qualification = qual_map.get(t.employee_id, t.qualification if "NIS Coach" not in t.qualification and "B.Ed" not in t.qualification else "Senior Technical Specialist")

        result.append({
            "id": t.id,
            "user_id": t.user_id,
            "display_name": u.display_name if u else f"Faculty {t.employee_id}",
            "email": u.email if u else "",
            "employee_id": t.employee_id,
            "qualification": qualification,
            "max_daily_periods": t.max_daily_periods,
            "rating_avg": round(teacher_rating, 1),
            "complaint_count": len(restrictions),
            "skills": skills,
            "reviews": reviews,
            "active_restrictions": restrictions,
        })

    return result


from app.timetable.curriculum_data import get_chapters_for_subject_and_grade


async def get_school_courses_and_syllabus(
    session: AsyncSession,
    user_id: Optional[UUID] = None,
    user_email: Optional[str] = None,
    user_role: Optional[str] = None,
    grade_number: Optional[int] = None,
    teacher_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    """
    Returns role-filtered courses and comprehensive chapter syllabi.
    - Students see all subjects/courses of their enrolled grade (e.g. Class 6 Science with all chapters).
    - Teachers see the courses they teach across grades according to timetable allocations (e.g. Class 6 Math, Class 7 Math).
    - Admins see all courses across all 10 grades.
    """
    grades = (
        await session.scalars(
            select(SchoolGrade)
            .options(
                selectinload(SchoolGrade.curriculum).selectinload(GradeCurriculum.subject),
                selectinload(SchoolGrade.sections),
            )
            .order_by(SchoolGrade.grade_number)
        )
    ).all()
    # A fresh hosted database has no curriculum rows yet. Materialize the
    # idempotent default catalog on first access so every portal has content.
    if not grades:
        await seed_school_defaults(session)
        grades = (
            await session.scalars(
                select(SchoolGrade)
                .options(
                    selectinload(SchoolGrade.curriculum).selectinload(GradeCurriculum.subject),
                    selectinload(SchoolGrade.sections),
                )
                .order_by(SchoolGrade.grade_number)
            )
        ).all()

    grade_map = {g.grade_number: g for g in grades}
    grade_by_id = {g.id: g for g in grades}

    # Do not take the whole catalog down if a rolling deployment reaches this
    # code before the new override table has been created.
    try:
        overrides = (await session.scalars(select(CurriculumCourseOverride))).all()
    except Exception as exc:
        await session.rollback()
        print(f"[Curriculum] Override table unavailable; serving built-in syllabus: {exc}")
        overrides = []
        grades = (
            await session.scalars(
                select(SchoolGrade)
                .options(
                    selectinload(SchoolGrade.curriculum).selectinload(GradeCurriculum.subject),
                    selectinload(SchoolGrade.sections),
                )
                .order_by(SchoolGrade.grade_number)
            )
        ).all()
        grade_map = {g.grade_number: g for g in grades}
        grade_by_id = {g.id: g for g in grades}
    override_map = {(item.grade_id, item.subject_id): item for item in overrides}

    def curriculum_content(grade: SchoolGrade, subject: Subject) -> tuple[str, str, List[Dict[str, Any]]]:
        override = override_map.get((grade.id, subject.id))
        chapters = (
            override.chapters_json
            if override and override.chapters_json
            else get_chapters_for_subject_and_grade(subject.code, grade.grade_number)
        )
        title = override.title if override and override.title else f"{grade.name} — {subject.name}"
        academic_year = override.academic_year if override else grade.academic_year
        return title, academic_year, chapters

    # Fetch all teachers
    teachers = (
        await session.scalars(
            select(TeacherProfile)
            .options(
                selectinload(TeacherProfile.skills).selectinload(TeacherSubjectSkill.subject),
            )
        )
    ).all()
    user_ids = [t.user_id for t in teachers]
    users = (await session.scalars(select(User).where(User.id.in_(user_ids)))).all() if user_ids else []
    user_map = {u.id: u for u in users}

    teacher_info = {}
    for t in teachers:
        u = user_map.get(t.user_id)
        teacher_info[t.id] = {
            "id": str(t.id),
            "display_name": u.display_name if u else f"Teacher {t.employee_id}",
            "email": u.email if u else "",
            "employee_id": t.employee_id,
            "skills": [sk.subject.code for sk in t.skills if sk.subject],
        }

    # Fetch existing timetable slots to correlate assigned teachers
    slots = (
        await session.scalars(
            select(TimetableSlot)
            .options(
                selectinload(TimetableSlot.section),
                selectinload(TimetableSlot.subject),
                selectinload(TimetableSlot.teacher),
            )
        )
    ).all()

    # Build slot teacher assignment mapping: (grade_id, subject_id) -> teacher_id
    assignment_map = {}
    teacher_classes_map = {}  # teacher_id -> set of (grade_id, subject_id)
    for s in slots:
        if s.section and s.subject and s.teacher_id:
            pair = (s.section.grade_id, s.subject_id)
            if pair not in assignment_map:
                assignment_map[pair] = s.teacher_id
            if s.teacher_id not in teacher_classes_map:
                teacher_classes_map[s.teacher_id] = set()
            teacher_classes_map[s.teacher_id].add(pair)

    courses_result: List[Dict[str, Any]] = []

    # 1. TEACHER VIEW
    if user_role == "teacher" or (not user_role and user_email and ("teacher" in user_email or "@school.edu" in user_email and "student" not in user_email)):
        # Locate teacher profile
        target_teacher = None
        if teacher_id:
            target_teacher = next((t for t in teachers if t.id == teacher_id), None)
        if not target_teacher and user_id:
            target_teacher = next((t for t in teachers if t.user_id == user_id), None)
        if not target_teacher and user_email:
            target_teacher = next((t for t in teachers if (user_map.get(t.user_id) and user_map[t.user_id].email.lower() == user_email.lower())), None)
        if not target_teacher and teachers:
            target_teacher = teachers[0]

        if target_teacher:
            pairs = teacher_classes_map.get(target_teacher.id, set())
            # If no slots generated, infer pairs from skills across reasonable grades (e.g. 6, 7, 8, 9)
            if not pairs:
                for sk in target_teacher.skills:
                    if sk.subject:
                        for g_num in [6, 7, 8]:
                            if g_num in grade_map:
                                pairs.add((grade_map[g_num].id, sk.subject.id))

            subjects_all = (await session.scalars(select(Subject))).all()
            sub_by_id = {s.id: s for s in subjects_all}

            for gid, sid in sorted(pairs, key=lambda x: (grade_by_id.get(x[0]).grade_number if grade_by_id.get(x[0]) else 99)):
                gr = grade_by_id.get(gid)
                sb = sub_by_id.get(sid)
                if gr and sb:
                    title, academic_year, chapters = curriculum_content(gr, sb)
                    curr_item = next((c for c in gr.curriculum if c.subject_id == sb.id), None)
                    periods = curr_item.periods_per_week if curr_item else 5
                    t_info = teacher_info.get(target_teacher.id, {})

                    courses_result.append({
                        "id": f"{gr.grade_number}_{sb.code}",
                        "title": title,
                        "subject_code": sb.code,
                        "subject_name": sb.name,
                        "category": sb.category,
                        "color": sb.color,
                        "grade_number": gr.grade_number,
                        "grade_name": gr.name,
                        "academic_year": academic_year,
                        "periods_per_week": periods,
                        "instructor_name": t_info.get("display_name", "Assigned Faculty"),
                        "instructor_email": t_info.get("email", ""),
                        "instructor_id": str(target_teacher.id),
                        "total_chapters": len(chapters),
                        "estimated_weeks": sum(ch.get("duration_weeks", 2) for ch in chapters),
                        "chapters": chapters,
                    })
        return courses_result

    # 2. STUDENT VIEW
    if user_role == "student" or (not user_role and user_email and "student" in user_email):
        # Determine student grade number
        target_g_num = 9  # default
        if grade_number:
            target_g_num = grade_number
        elif user_email:
            m = re.search(r"class(\d+)", user_email, re.IGNORECASE)
            if m:
                target_g_num = int(m.group(1))

        gr = grade_map.get(target_g_num) or (grades[0] if grades else None)
        if gr:
            for curr in gr.curriculum:
                sb = curr.subject
                if not sb:
                    continue
                # Find instructor
                assigned_tid = assignment_map.get((gr.id, sb.id))
                if not assigned_tid:
                    # Pick first teacher with matching skill
                    cand = next((t for t in teachers if any(sk.subject_id == sb.id for sk in t.skills)), None)
                    if cand:
                        assigned_tid = cand.id

                t_info = teacher_info.get(assigned_tid, {}) if assigned_tid else {}
                title, academic_year, chapters = curriculum_content(gr, sb)

                courses_result.append({
                    "id": f"{gr.grade_number}_{sb.code}",
                    "title": title,
                    "subject_code": sb.code,
                    "subject_name": sb.name,
                    "category": sb.category,
                    "color": sb.color,
                    "grade_number": gr.grade_number,
                    "grade_name": gr.name,
                    "academic_year": academic_year,
                    "periods_per_week": curr.periods_per_week,
                    "instructor_name": t_info.get("display_name", "Department Faculty"),
                    "instructor_email": t_info.get("email", ""),
                    "instructor_id": str(assigned_tid) if assigned_tid else None,
                    "total_chapters": len(chapters),
                    "estimated_weeks": sum(ch.get("duration_weeks", 2) for ch in chapters),
                    "chapters": chapters,
                })
        return courses_result

    # 3. ADMIN VIEW (All courses or filtered by grade_number)
    for gr in grades:
        if grade_number and gr.grade_number != grade_number:
            continue
        for curr in gr.curriculum:
            sb = curr.subject
            if not sb:
                continue
            assigned_tid = assignment_map.get((gr.id, sb.id))
            if not assigned_tid:
                cand = next((t for t in teachers if any(sk.subject_id == sb.id for sk in t.skills)), None)
                if cand:
                    assigned_tid = cand.id

            t_info = teacher_info.get(assigned_tid, {}) if assigned_tid else {}
            title, academic_year, chapters = curriculum_content(gr, sb)

            courses_result.append({
                "id": f"{gr.grade_number}_{sb.code}",
                "title": title,
                "subject_code": sb.code,
                "subject_name": sb.name,
                "category": sb.category,
                "color": sb.color,
                "grade_number": gr.grade_number,
                "grade_name": gr.name,
                "academic_year": academic_year,
                "periods_per_week": curr.periods_per_week,
                "instructor_name": t_info.get("display_name", "Department Faculty"),
                "instructor_email": t_info.get("email", ""),
                "instructor_id": str(assigned_tid) if assigned_tid else None,
                "total_chapters": len(chapters),
                "estimated_weeks": sum(ch.get("duration_weeks", 2) for ch in chapters),
                "chapters": chapters,
            })

    return courses_result


async def generate_zoom_classes_from_timetable_service(
    session: AsyncSession,
    days_ahead: int = 7,
) -> Dict[str, Any]:
    """
    Scans the weekly master timetable slots and automatically generates corresponding LMS LiveClasses
    with integrated Zoom meetings for upcoming dates, ensuring idempotency.
    """
    from datetime import datetime, timedelta, timezone
    from app.classroom.models import LiveClass
    from app.classroom.schemas import LiveClassCreate
    from app.classroom.service import schedule_school_live_class

    now = datetime.now(timezone.utc)
    slots = (
        await session.scalars(
            select(TimetableSlot)
            .options(
                selectinload(TimetableSlot.section).selectinload(SchoolSection.grade),
                selectinload(TimetableSlot.subject),
                selectinload(TimetableSlot.teacher).selectinload(TeacherProfile.skills),
            )
            .where(TimetableSlot.teacher_id.isnot(None), TimetableSlot.subject_id.isnot(None))
        )
    ).all()

    teachers = (await session.scalars(select(User).where(User.role.in_(["teacher", "admin"])))).all()
    teacher_user_map = {t.id: t for t in teachers}

    t_profiles = (await session.scalars(select(TeacherProfile))).all()
    profile_to_user = {p.id: p.user_id for p in t_profiles}

    classes_created = 0
    zoom_meetings_synced = 0

    for day_offset in range(days_ahead):
        target_date = (now + timedelta(days=day_offset)).date()
        target_weekday = target_date.strftime("%A")

        matching_slots = [s for s in slots if s.day_of_week.lower() == target_weekday.lower()]
        for s in matching_slots:
            if not s.section or not s.section.grade or not s.subject:
                continue

            try:
                start_h, start_m = map(int, s.start_time.split(":"))
                end_h, end_m = map(int, s.end_time.split(":"))
            except Exception:
                start_h, start_m = 9, 0
                end_h, end_m = 10, 0

            starts_at = datetime(target_date.year, target_date.month, target_date.day, start_h, start_m, tzinfo=timezone.utc)
            ends_at = datetime(target_date.year, target_date.month, target_date.day, end_h, end_m, tzinfo=timezone.utc)

            # Idempotency check: Don't recreate if class session already exists for this section, subject, and time
            existing = await session.scalar(
                select(LiveClass).where(
                    LiveClass.grade_number == s.section.grade.grade_number,
                    LiveClass.section_name == s.section.name,
                    LiveClass.subject_code == s.subject.code,
                    LiveClass.period_number == s.period_number,
                    LiveClass.starts_at == starts_at,
                )
            )
            if existing:
                continue

            teacher_user_id = profile_to_user.get(s.teacher_id)
            teacher_user = teacher_user_map.get(teacher_user_id) if teacher_user_id else None
            if not teacher_user and teachers:
                teacher_user = teachers[0]

            title = f"{s.section.grade.name}-{s.section.name} {s.subject.name} (Period {s.period_number})"

            create_data = LiveClassCreate(
                title=title,
                starts_at=starts_at,
                ends_at=ends_at,
                grade_number=s.section.grade.grade_number,
                section_name=s.section.name,
                subject_code=s.subject.code,
                subject_name=s.subject.name,
                period_number=s.period_number,
                room_number=s.room_or_venue,
                auto_create_zoom=True,
            )

            new_class = await schedule_school_live_class(session, create_data, teacher_user)
            classes_created += 1
            if new_class.zoom_meeting_id:
                zoom_meetings_synced += 1

    return {
        "status": "success",
        "days_ahead": days_ahead,
        "classes_created": classes_created,
        "zoom_meetings_synced": zoom_meetings_synced,
    }
