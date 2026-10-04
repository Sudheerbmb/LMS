import json
import os
from typing import Any, Dict, List, Optional
from app.platform.config import settings

GROQ_KEY = settings.groq_api_key or os.getenv("GROQ_API_KEY")


from app.learning_agent.langgraph_engine import call_groq_resilient


async def call_groq_llm(messages: List[Dict[str, str]], model: Optional[str] = None, json_mode: bool = False) -> str:
    """Invokes Groq Cloud LPU with resilient multi-model failover."""
    return await call_groq_resilient(messages, temperature=0.2)


async def generate_dynamic_diagnostic_questions(
    grade_name: str,
    subjects: List[str],
    num_questions: int = 6,
) -> List[Dict[str, Any]]:
    """
    Section 12 & 13: Dynamic AI Generation of Multi-dimensional Diagnostic Items
    Strictly grounded in student's grade and enrolled curriculum standards.
    """
    prompt = f"""You are an expert psychometric assessment designer for primary and secondary education.
Generate a dynamic {num_questions}-question baseline diagnostic assessment for a student in **{grade_name}**.

The assessment MUST cover these enrolled subjects: {', '.join(subjects)}.

Return ONLY a JSON object with a key "questions" containing a list of {num_questions} questions formatted exactly as follows:
{{
  "questions": [
    {{
      "id": "q1",
      "subject": "{subjects[0]}",
      "concept": "Core Concept Name",
      "prompt": "Clear, age-appropriate question prompt for {grade_name}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "difficulty": 0.45,
      "cognitive_level": "FOUNDATION",
      "misconception_tag": "common_misconception_if_failed"
    }}
  ]
}}

Requirements:
1. Ensure questions strictly match {grade_name} curriculum topics in {', '.join(subjects)}.
2. Exactly 4 options per question with 1 unambiguous correct answer.
3. Vary cognitive levels across FOUNDATION, APPLICATION, REASONING, TRANSFER.
"""
    response_text = await call_groq_llm(
        messages=[
            {"role": "system", "content": "You are a specialized technical institute psychometric assessment generator. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        model="llama-3.3-70b-versatile",
        json_mode=True,
    )

    if response_text:
        try:
            data = json.loads(response_text)
            if "questions" in data and isinstance(data["questions"], list) and len(data["questions"]) > 0:
                return data["questions"]
        except Exception as e:
            print(f"JSON parsing error: {e}")

    # High-fidelity technical institute aligned fallback bank
    return [
        {
            "id": "q1",
            "subject": "Python Core & Advanced OOP",
            "concept": "AsyncIO & Structured Concurrency",
            "prompt": "In Python 3.12+, which construct provides structured concurrency ensuring all child tasks complete or cancel gracefully?",
            "options": ["async with asyncio.TaskGroup() as tg: ...", "asyncio.gather(*tasks)", "threading.Thread(target=task).start()", "loop.run_until_complete(tasks)"],
            "correct_index": 0,
            "difficulty": 0.45,
            "cognitive_level": "APPLICATION",
        },
        {
            "id": "q2",
            "subject": "Prompt Engineering, LLMs & LangChain",
            "concept": "LangChain LCEL Runnables",
            "prompt": "Which LangChain Runnable primitive allows passing incoming state unmodified to subsequent dictionary branches?",
            "options": ["RunnablePassthrough()", "RunnableFallback()", "RunnableLambda()", "RunnableSequence()"],
            "correct_index": 0,
            "difficulty": 0.40,
            "cognitive_level": "FOUNDATION",
        },
        {
            "id": "q3",
            "subject": "RAG & Vector DBs",
            "concept": "Vector Indexing Algorithms",
            "prompt": "Which graph-based index algorithm is most widely used in vector databases for sub-millisecond Approximate Nearest Neighbor (ANN) search?",
            "options": ["HNSW (Hierarchical Navigable Small World)", "B-Tree Indexing", "Inverted Hash Table", "Radix Tree"],
            "correct_index": 0,
            "difficulty": 0.50,
            "cognitive_level": "REASONING",
        },
        {
            "id": "q4",
            "subject": "Autonomous Agents & FastAPI Deployment",
            "concept": "LangGraph Stateful Agents",
            "prompt": "In LangGraph multi-agent architectures, what component manages graph memory persistence and time-travel debugging?",
            "options": ["BaseCheckpointSaver (e.g. MemorySaver)", "FastAPI BackgroundTasks", "HTTP Session Cookies", "Uvicorn Worker State"],
            "correct_index": 0,
            "difficulty": 0.55,
            "cognitive_level": "REASONING",
        },
        {
            "id": "q5",
            "subject": "Enterprise Backend & Cloud",
            "concept": "Database Concurrency & ACID",
            "prompt": "In SQLAlchemy AsyncSession, what occurs if an unhandled exception triggers before session.commit()?",
            "options": ["The transaction rolls back automatically upon context manager exit", "Data is partially persisted to disk", "The connection pool hangs indefinitely", "The database table locks permanently"],
            "correct_index": 0,
            "difficulty": 0.45,
            "cognitive_level": "APPLICATION",
        },
        {
            "id": "q6",
            "subject": "Cloud & DevOps AWS SRE",
            "concept": "Docker Multi-Stage Optimization",
            "prompt": "Why are multi-stage Docker builds recommended for Python & React production containers?",
            "options": ["They exclude build tools and compilers from the final image, drastically reducing size and attack surface", "They increase CPU clock speed during runtime", "They bypass the need for environment variables", "They allow running multiple OS kernels in one container"],
            "correct_index": 0,
            "difficulty": 0.35,
            "cognitive_level": "FOUNDATION",
        },
    ]


async def generate_sn1_chat_response(
    student_name: str,
    grade_name: str,
    subjects: List[str],
    state_vector: Dict[str, Any],
    user_message: str,
) -> str:
    """
    Section 84 & 39: SN1 Grounded Agent Reasoning using Groq LLM
    """
    is_calibrated = state_vector.get("is_calibrated", False)
    
    system_prompt = f"""You are SN1, the autonomous Student Neural Intelligence agent operating on top of the LENS-Ω engine.
You are assisting {student_name}, enrolled in {grade_name} studying {', '.join(subjects)}.

Strict Operational Directives:
1. Ground every statement strictly in the provided mathematical state vector S_t.
2. If the student has zero diagnostic baseline evidence (is_calibrated=False), explain that uncertainty is 95% and encourage taking the baseline diagnostic.
3. If calibrated, explain the student's active bottleneck ({state_vector.get('current_bottleneck')}) and provide actionable, encouraging guidance.
4. Keep answers concise, clear, and age-appropriate for {grade_name}.
"""
    state_context = f"""
Student Name: {student_name}
Grade / Enrolled Curriculum: {grade_name}
Subjects: {', '.join(subjects)}
Calibrated: {is_calibrated}
Mastery (M): {state_vector.get('mastery', 0.0):.1%}
Retention (R): {state_vector.get('retention', 0.0):.1%}
Transfer (T): {state_vector.get('transfer', 0.0):.1%}
Misconception (MS): {state_vector.get('misconception', 0.0):.1%}
Holistic Competency (C): {state_vector.get('competency', 0.0):.1%}
Epistemic Uncertainty (U): {state_vector.get('uncertainty', 0.95):.1%}
Identifiability (I): {state_vector.get('identifiability', 0.0):.1%}
Active Bottleneck: {state_vector.get('current_bottleneck', 'INSUFFICIENT_EVIDENCE')}
Learning Mode: {state_vector.get('current_learning_mode', 'DIAGNOSTIC')}
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"State Vector Data:\n{state_context}\n\nStudent Question: \"{user_message}\""}
    ]

    llm_resp = await call_groq_llm(messages, model="llama-3.3-70b-versatile")
    if llm_resp:
        return llm_resp
    
    # Fallback explanation
    if not is_calibrated:
        return (
            f"Hello {student_name}! Because you have zero diagnostic evidence in {grade_name} yet, "
            f"my epistemic uncertainty is at 95%. Taking the diagnostic assessment will calibrate your true learning curve."
        )
    return (
        f"Based on your {grade_name} state vector (Competency: {state_vector.get('competency', 0.0):.0%}, "
        f"Bottleneck: {state_vector.get('current_bottleneck')}), I recommend completing your scheduled practice."
    )
