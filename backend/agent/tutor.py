import json
import os
import math
import random
from groq import Groq

client: Groq | None = None
MODEL = "llama-3.3-70b-versatile"


def _get_client() -> Groq:
    global client
    if client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is required for tutor generation")
        client = Groq(api_key=api_key)
    return client

# ── Prompts ────────────────────────────────────────────────────────────────────

FIRST_QUESTION_PROMPT = """You are a Socratic tutor. Your ONLY job is to ask questions — never give answers, never explain.

Topic the student wants to learn: {topic}
Goal: {goal}

Ask the very first question to probe their baseline understanding. 

Rules:
- Ask exactly ONE question
- Make it open-ended — not yes/no
- Start somewhere fundamental but not condescending
- The question should reveal what they already know
- Do NOT explain anything. Do NOT say "Great!" or "Let's start by..." — just ask the question.
- Tone: a wise, curious mentor. Slightly formal. Genuinely interested.

Return ONLY the question text. Nothing else."""

NEXT_QUESTION_PROMPT = """You are a Socratic tutor. NEVER give answers. NEVER explain. ONLY ask questions.

Topic: {topic}
Goal: {goal}

CONVERSATION SO FAR:
{history}

CURRENT KNOWLEDGE GRAPH (what we know about the student so far):
{graph_summary}

Based on their answer, ask the next question. 

Strategy:
- If they answered confidently and correctly → go deeper or to a related concept
- If they answered shakily → probe the specific shaky part (don't reveal the answer, make them think)
- If they answered incorrectly → ask a question that makes them realise the contradiction themselves
- If they said "I don't know" → ask a simpler prerequisite question to find their actual floor
- Never repeat a question you already asked
- Each question should reveal something NEW about their understanding

Return ONLY the question. No preamble. No "Great!" No explanation."""

ASSESS_PROMPT = """You are assessing a student's answer in a Socratic tutoring session.

Topic: {topic}
Question asked: {question}
Student's answer: {answer}

Analyze their answer and return JSON only:
{{
  "confidence": <float 0.0-1.0>,
  "correctness": "correct"|"partial"|"incorrect"|"unknown"|"refused",
  "concepts_demonstrated": [
    {{"name": "concept name", "confidence": 0.0-1.0, "state": "shaky|confident|mastered", "evidence": "what they said"}}
  ],
  "concepts_missing": ["concept they should know but don't"],
  "reasoning_quality": "surface|mechanical|deep",
  "follow_up_direction": "deeper|sideways|prerequisite|clarify",
  "internal_note": "what this answer reveals about their mental model (for tutor use)"
}}

Rules:
- confidence 0.0 = completely wrong/no idea, 1.0 = mastered
- Be harsh but fair. Hedging and vague answers are NOT confident
- "refused" = "I don't know" or similar
- Extract concepts even from wrong answers (they reveal misconceptions)"""

GRAPH_INIT_PROMPT = """For the topic "{topic}", generate the core concept graph a learner needs.

Return JSON only:
{{
  "concepts": [
    {{"name": "concept", "level": 1}},
    {{"name": "concept", "level": 2}}
  ],
  "edges": [
    {{"source": "concept A", "target": "concept B", "relation": "requires"}}
  ]
}}

Rules:
- 8-15 concepts maximum
- level 1 = foundational, level 3 = advanced
- edges show dependencies (source must be understood before target)
- Names should be specific, not vague ("gradient descent" not "optimization")
- Only include concepts genuinely central to this topic"""


# ── Graph layout ───────────────────────────────────────────────────────────────

def _assign_positions(concepts: list[dict]) -> list[dict]:
    """Assign x,y positions using a simple force-directed-like layout."""
    levels = {}
    for c in concepts:
        lvl = c.get("level", 1)
        levels.setdefault(lvl, []).append(c)

    positioned = []
    cx, cy = 500, 350  # canvas center

    for lvl, nodes in sorted(levels.items()):
        radius = 150 + (lvl - 1) * 110
        for i, node in enumerate(nodes):
            angle = (2 * math.pi * i / len(nodes)) + (lvl * 0.4)
            x = cx + radius * math.cos(angle) + random.uniform(-20, 20)
            y = cy + radius * math.sin(angle) + random.uniform(-20, 20)
            node["x"] = round(x, 1)
            node["y"] = round(y, 1)
            positioned.append(node)

    return positioned


# ── Public API ─────────────────────────────────────────────────────────────────

def _clean_json(raw: str) -> str:
    text = raw.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            p = part.lstrip("json").strip()
            if p.startswith("{") or p.startswith("["):
                return p.split("```")[0].strip()
    start = text.find("{")
    if start != -1:
        return text[start:]
    return text


def initialize_graph(topic: str) -> dict:
    """Generate initial concept graph for a topic."""
    try:
        resp = _get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": GRAPH_INIT_PROMPT.format(topic=topic)}],
            max_tokens=1000,
            temperature=0.2,
        )
        data = json.loads(_clean_json(resp.choices[0].message.content))
        data["concepts"] = _assign_positions(data.get("concepts", []))
        return data
    except Exception:
        return {"concepts": [], "edges": []}


def get_first_question(topic: str, goal: str) -> str:
    """Ask the opening Socratic question."""
    resp = _get_client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": FIRST_QUESTION_PROMPT.format(topic=topic, goal=goal or topic)}],
        max_tokens=200,
        temperature=0.7,
    )
    return resp.choices[0].message.content.strip()


def assess_answer(topic: str, question: str, answer: str) -> dict:
    """Assess a student answer and extract concept evidence."""
    prompt = ASSESS_PROMPT.format(topic=topic, question=question, answer=answer)
    try:
        resp = _get_client().chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.1,
        )
        return json.loads(_clean_json(resp.choices[0].message.content))
    except Exception:
        return {
            "confidence": 0.3,
            "correctness": "unknown",
            "concepts_demonstrated": [],
            "concepts_missing": [],
            "reasoning_quality": "surface",
            "follow_up_direction": "clarify",
            "internal_note": "",
        }


def get_next_question(
    topic: str,
    goal: str,
    history: list[dict],
    graph_summary: str,
) -> str:
    """Generate the next Socratic question based on conversation + graph state."""
    history_text = ""
    for turn in history[-6:]:  # last 6 turns for context
        history_text += f"Q: {turn['question']}\nA: {turn.get('answer', '(no answer)')}\n\n"

    prompt = NEXT_QUESTION_PROMPT.format(
        topic=topic,
        goal=goal or topic,
        history=history_text.strip(),
        graph_summary=graph_summary,
    )
    resp = _get_client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.75,
    )
    return resp.choices[0].message.content.strip()


def build_graph_summary(nodes: list[dict]) -> str:
    """Summarize the current knowledge graph state for prompt context."""
    if not nodes:
        return "No concepts mapped yet."
    lines = []
    for n in nodes:
        state = n.get("state", "unknown")
        conf = n.get("confidence", 0.0)
        if state != "unknown":
            lines.append(f"- {n['name']}: {state} ({conf:.0%})")
    if not lines:
        return "No concepts assessed yet."
    return "\n".join(lines)


def merge_assessment_into_graph(
    existing_nodes: list[dict],
    assessment: dict,
    topic_concepts: list[dict],
) -> list[dict]:
    """
    Update or create nodes in the knowledge graph based on an assessment.
    Returns the updated node list.
    """
    node_map = {n["name"].lower(): n for n in existing_nodes}

    # Ensure topic concepts exist in graph (with unknown state)
    for tc in topic_concepts:
        key = tc["name"].lower()
        if key not in node_map:
            node_map[key] = {
                "name": tc["name"],
                "confidence": 0.0,
                "state": "unknown",
                "x": tc.get("x", 500),
                "y": tc.get("y", 350),
                "evidence": None,
            }

    # Apply demonstrated concepts
    for cd in assessment.get("concepts_demonstrated", []):
        name = cd.get("name", "")
        if not name:
            continue
        key = name.lower()
        new_conf = cd.get("confidence", 0.3)

        if key in node_map:
            # Blend: move toward new confidence (don't thrash)
            old = node_map[key].get("confidence", 0.0)
            blended = old * 0.5 + new_conf * 0.5
            node_map[key]["confidence"] = round(blended, 2)
            node_map[key]["state"] = _confidence_to_state(blended)
            if cd.get("evidence"):
                node_map[key]["evidence"] = cd["evidence"]
        else:
            # New concept revealed — add to graph with a position
            angle = len(node_map) * 0.7
            node_map[key] = {
                "name": name,
                "confidence": new_conf,
                "state": _confidence_to_state(new_conf),
                "x": round(500 + 180 * math.cos(angle), 1),
                "y": round(350 + 180 * math.sin(angle), 1),
                "evidence": cd.get("evidence"),
            }

    return list(node_map.values())


def _confidence_to_state(conf: float) -> str:
    if conf < 0.15:
        return "unknown"
    if conf < 0.35:
        return "inferred"
    if conf < 0.6:
        return "shaky"
    if conf < 0.85:
        return "confident"
    return "mastered"
