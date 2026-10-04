"""
Multi-Agent Orchestration FastAPI Router
Exposes CrewAI and AutoGen endpoints to Omni-LMS.
"""
from fastapi import APIRouter
from app.agents.crew_curriculum import (
    CrewCurriculumRequest,
    CrewCurriculumResponse,
    run_crew_curriculum_designer
)
from app.agents.autogen_viva import (
    VivaRoundRequest,
    VivaRoundResponse,
    process_autogen_viva_round
)

from app.agents.copilot import (
    CopilotReasonRequest,
    CopilotReasonResponse,
    reason_copilot_intent
)

from typing import Any, Dict, List, Optional
import os
import httpx
from pydantic import BaseModel
from app.platform.config import settings

router = APIRouter(prefix="/api/v1/agents", tags=["multi-agents"])


class ChatCompletionRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = "llama-3.3-70b-versatile"
    temperature: Optional[float] = 0.2
    json_mode: Optional[bool] = False
    max_tokens: Optional[int] = 1200


@router.post("/chat/completions")
async def chat_completions_proxy(req: ChatCompletionRequest):
    """
    Secure server-side proxy for Groq Cloud LPU inferences.
    Keeps API keys strictly server-side and applies automatic fallbacks.
    """
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return {"choices": [{"message": {"content": "Groq API key not configured on backend."}}]}

    candidate_models = [
        req.model,
        "llama-3.3-70b-versatile",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
    ]
    candidate_models = [m for m in candidate_models if m]

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    for model_name in candidate_models:
        payload: Dict[str, Any] = {
            "model": model_name,
            "messages": req.messages,
            "temperature": req.temperature,
            "max_tokens": req.max_tokens,
        }
        if req.json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            print(f"[Groq Proxy Exception with {model_name}]: {e}")

    return {"choices": [{"message": {"content": "{}"}}]}


@router.post("/curriculum/crew", response_model=CrewCurriculumResponse)
async def generate_curriculum_crew(req: CrewCurriculumRequest):
    """
    Triggers CrewAI multi-agent curriculum studio with 3 collaborating agents.
    """
    return await run_crew_curriculum_designer(req)


@router.post("/viva/round", response_model=VivaRoundResponse)
async def execute_viva_round(req: VivaRoundRequest):
    """
    Executes a multi-agent AutoGen conversational oral defense round.
    """
    return await process_autogen_viva_round(req)


@router.post("/copilot/reason", response_model=CopilotReasonResponse)
async def execute_copilot_reasoning(req: CopilotReasonRequest):
    """
    Autonomous Groq LPU reasoning engine for the Universal Omni-Copilot.
    """
    return await reason_copilot_intent(req)

