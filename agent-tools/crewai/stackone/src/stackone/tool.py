from os import getenv
from typing import Optional

from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from stackone_ai import StackOneToolSet


def _get_filter(value: Optional[str] = None) -> str:
    return value or getenv("STACKONE_INTEGRATION_FILTER", "*")


class StackoneExecuteToolInput(BaseModel):
    account_id: str = Field(..., description="StackOne account ID")
    action: str = Field(..., description="Tool name or identifier to execute")
    parameters: Optional[dict] = Field(None, description="Parameters to pass to the tool")


class StackoneListToolsInput(BaseModel):
    account_id: str = Field(..., description="StackOne account ID")


class StackoneSearchToolsInput(BaseModel):
    account_id: str = Field(..., description="StackOne account ID")
    query: Optional[str] = Field(None, description="Query to search for tools")
    limit: int = Field(5, description="Max number of tools to return")


class StackoneExecuteTool(BaseTool):
    name: str = "StackOne Execute Tool"
    description: str = "Execute a specific StackOne tool by name or identifier"
    args_schema = StackoneExecuteToolInput

    def _run(self, account_id: str, action: str, parameters: Optional[dict] = None) -> str:
        try:
            toolset = StackOneToolSet()
            tools = toolset.get_tools(_get_filter(), account_id=account_id).meta_tools()
            execute_tool = tools.get_tool("meta_execute_tool")
            result = execute_tool.call(toolName=action, params=parameters or {}, account_id=account_id)
            return str(result)
        except Exception as e:
            return f"Error executing StackOne tool: {e}"


class StackoneListTools(BaseTool):
    name: str = "StackOne List Tools"
    description: str = "List available StackOne tools for the given account"
    args_schema = StackoneListToolsInput

    def _run(self, account_id: str) -> str:
        try:
            toolset = StackOneToolSet()
            tools = toolset.get_tools(_get_filter(), account_id=account_id).meta_tools()
            list_tool = tools.get_tool("meta_list_tools")
            result = list_tool.call(account_id=account_id)
            return str(result)
        except Exception as e:
            return f"Error listing StackOne tools: {e}"


class StackoneSearchTools(BaseTool):
    name: str = "StackOne Search Tools"
    description: str = "Search for StackOne tools matching a query"
    args_schema = StackoneSearchToolsInput

    def _run(self, account_id: str, query: Optional[str] = None, limit: int = 5) -> str:
        try:
            toolset = StackOneToolSet()
            tools = toolset.get_tools(_get_filter(), account_id=account_id).meta_tools()
            search_tool = tools.get_tool("meta_search_tools")
            result = search_tool.call(query=query or "*", limit=limit, account_id=account_id)
            return str(result)
        except Exception as e:
            return f"Error searching StackOne tools: {e}"

