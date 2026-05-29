"""AI-powered natural-language insights using the Emergent Universal LLM key."""
import os
import json
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage

MODEL_PROVIDER = "openai"
MODEL_NAME = "gpt-4o"

SYSTEM_MESSAGE = (
    "You are SkyOps AI, the operational intelligence advisor for an airline analytics "
    "platform. You translate statistical findings into crisp, executive-grade operational "
    "insights and concrete recommendations. Never mention formulas, p-values, statistics "
    "jargon, or that you are an AI model. Speak like a seasoned airline operations strategist. "
    "Always respond ONLY with valid minified JSON."
)


async def generate_insights(scope: str, context: dict) -> dict:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return _fallback(scope, context)

    prompt = (
        f"Operational scope: {scope}.\n"
        f"Live operational data (JSON): {json.dumps(context)[:3500]}.\n\n"
        "Return JSON with this exact shape: "
        '{"headline": string, "summary": string (<=320 chars), '
        '"recommendations": [{"title": string, "detail": string, "priority": "high"|"medium"|"low"}] (3 to 4 items), '
        '"risk_callout": string (<=160 chars)}. '
        "Make it specific to the numbers provided. No markdown, JSON only."
    )
    try:
        chat = LlmChat(
            api_key=key,
            session_id=f"skyops-{scope}-{uuid.uuid4()}",
            system_message=SYSTEM_MESSAGE,
        ).with_model(MODEL_PROVIDER, MODEL_NAME)
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
        data["generated_by"] = f"{MODEL_PROVIDER}:{MODEL_NAME}"
        return data
    except Exception as e:
        out = _fallback(scope, context)
        out["note"] = f"AI fallback ({type(e).__name__})"
        return out


def _fallback(scope: str, context: dict) -> dict:
    return {
        "headline": "Operational summary",
        "summary": "Live analysis is being compiled from the latest operational signals.",
        "recommendations": [
            {"title": "Monitor delay-prone routes", "detail": "Prioritise recovery on flights exceeding 60 minutes of delay.", "priority": "high"},
            {"title": "Reinforce cabin service", "detail": "Boost onboard service and seat-comfort touchpoints on economy segments.", "priority": "medium"},
            {"title": "Pre-empt congestion", "detail": "Stagger departures at high-congestion hubs.", "priority": "medium"},
        ],
        "risk_callout": "Elevated delays and congestion may pressure satisfaction in the next operating window.",
        "generated_by": "rules-engine",
    }
