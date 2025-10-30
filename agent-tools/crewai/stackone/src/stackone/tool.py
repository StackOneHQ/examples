from os import getenv
from typing import Sequence

from crewai.tools import tool
from stackone_ai import StackOneToolSet


@tool("StackOne Meta Tool Executor")
def stackone_meta_execute_tool(account_id: str, action: str, parameters: dict | None = None) -> str:
    """
    Execute a specific StackOne tool by name or identifier.
    """
    try:
        selected_filter = getenv("STACKONE_INTEGRATION_FILTER", "*")
        toolset = StackOneToolSet()
        tools = toolset.get_tools(selected_filter, account_id=account_id).meta_tools()
        execute_tool = tools.get_tool("meta_execute_tool")
        result = execute_tool.call(toolName=action, params=parameters or {}, account_id=account_id)
        return str(result)
    except Exception as e:
        return f"Error executing StackOne tool: {e}"


@tool("StackOne Meta List Tools")
def stackone_meta_list_tools(account_id: str) -> str:
    """
    List available StackOne tools for the given account.
    """
    try:
        selected_filter = getenv("STACKONE_INTEGRATION_FILTER", "*")
        toolset = StackOneToolSet()
        tools = toolset.get_tools(selected_filter, account_id=account_id).meta_tools()
        list_tool = tools.get_tool("meta_list_tools")
        result = list_tool.call(account_id=account_id)
        return str(result)
    except Exception as e:
        return f"Error listing StackOne tools: {e}"


@tool("StackOne Meta Search Tools")
def stackone_meta_search_tools(account_id: str, query: str | None = None, limit: int = 5) -> str:
    """
    Search for StackOne tools matching a query.
    """
    try:
        selected_filter = getenv("STACKONE_INTEGRATION_FILTER", "*")
        toolset = StackOneToolSet()
        tools = toolset.get_tools(selected_filter, account_id=account_id).meta_tools()
        search_tool = tools.get_tool("meta_search_tools")
        result = search_tool.call(query=query or "*", limit=limit, account_id=account_id)
        return str(result)
    except Exception as e:
        return f"Error searching StackOne tools: {e}"


def Stackone(account_id: str, integration_filter: str | None = None) -> Sequence[object]:
    """
    Return CrewAI-compatible tool instances generated from StackOne tools.

    Usage in CrewAI:
      tools=[*Stackone(account_id)]  # unpack the returned sequence
    """
    selected_filter = integration_filter or getenv("STACKONE_INTEGRATION_FILTER", "*")
    toolset = StackOneToolSet()
    tools = toolset.get_tools(selected_filter, account_id=account_id)
    return tuple(tools.to_crewai())

