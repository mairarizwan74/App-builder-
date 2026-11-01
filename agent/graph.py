import time
from dotenv import load_dotenv
from langchain_core.globals import set_debug, set_verbose
from langchain_groq import ChatGroq
from langgraph.constants import END
from langgraph.graph import StateGraph
from langgraph.prebuilt import create_react_agent
from langgraph.errors import GraphRecursionError

from agent.prompts import architect_prompt, coder_system_prompt, planner_prompt
from agent.states import CoderState, Plan, TaskPlan
from agent.tools import read_file, write_file

_ = load_dotenv()

set_debug(False)
set_verbose(False)

llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0)


def planner_agent(state: dict) -> dict:
    """Converts the user prompt into a structured Plan."""
    user_prompt = state["user_prompt"]
    resp = llm.with_structured_output(Plan).invoke(planner_prompt(user_prompt))
    if resp is None:
        raise ValueError("Planner did not return a valid response.")
    return {"plan": resp}


def architect_agent(state: dict) -> dict:
    """Creates a TaskPlan (ordered implementation steps) from the Plan."""
    plan: Plan = state["plan"]
    structured_llm = llm.with_structured_output(TaskPlan)

    resp = None
    for attempt in range(3):
        try:
            resp = structured_llm.invoke(architect_prompt(plan=plan.model_dump_json()))
            if resp is not None:
                break
        except Exception as e:
            print(f"Architect attempt {attempt + 1} failed: {type(e).__name__}")
            time.sleep(5)

    if resp is None:
        raise ValueError("Architect did not return a valid response after 3 tries.")

    resp.plan = plan
    return {"task_plan": resp}


def coder_agent(state: dict) -> dict:
    """Implements one task at a time using a ReAct agent with file tools."""
    coder_state = state.get("coder_state")

    if coder_state is None:
        task_plan = state["task_plan"]
        coder_state = CoderState(task_plan=task_plan, current_step_idx=0)

    steps = coder_state.task_plan.implementation_steps
    if coder_state.current_step_idx >= len(steps):
        return {"coder_state": coder_state, "status": "DONE"}

    current_task = steps[coder_state.current_step_idx]
    print(f"\n--- Implementing Step {coder_state.current_step_idx + 1}/{len(steps)}: {current_task.filepath} ---")

    existing_content = read_file.run(current_task.filepath)[:1500]

    system_prompt = coder_system_prompt()
    user_prompt = (
        f"Task: {current_task.task_description}\n"
        f"File: {current_task.filepath}\n"
        f"Existing content (may be empty):\n{existing_content}\n"
        "Use write_file(path, content) to save the full file. Do not forget to implement full code."
    )

    react_agent = create_react_agent(llm, [read_file, write_file])

    success = False
    for attempt in range(3):
        try:
            react_agent.invoke(
                {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ]
                },
                {"recursion_limit": 20},
            )
            success = True
            break
        except GraphRecursionError:
            success = True
            break
        except Exception as e:
            print(f"Coder attempt {attempt + 1} failed for {current_task.filepath}: {type(e).__name__} - {e}")
            time.sleep(15)  # API cooldown

    coder_state.current_step_idx += 1
    time.sleep(10)  # Rate limit safety buffer between files

    status = "DONE" if coder_state.current_step_idx >= len(steps) else "CONT"
    return {"coder_state": coder_state, "status": status}

# Graph Routing Logic
def should_continue(state: dict) -> str:
    if state.get("status") == "DONE":
        return "end"
    return "coder"


graph = StateGraph(dict)

graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder", coder_agent)

graph.add_edge("planner", "architect")
graph.add_edge("architect", "coder")

graph.add_conditional_edges(
    "coder",
    should_continue,
    {
        "coder": "coder",
        "end": END,
    },
)

graph.set_entry_point("planner")
agent = graph.compile()

if __name__ == "__main__":
    result = agent.invoke(
        {"user_prompt": "Create a fully functional calculator web application with html, css, and javascript"},
        {"recursion_limit": 100},
    )
    print("Final State:", result)