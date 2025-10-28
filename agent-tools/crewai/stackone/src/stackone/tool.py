from crewai.tools import tool
from stackone_ai import StackOneToolSet
from typing import Dict, Any
import os

# Set up API keys
api_key = os.getenv("STACKONE_API_KEY")


@tool("StackOne Tool Executor")
def stackone_tool_executor(account_id: str, action: str, parameters: dict = None) -> str:
    """
    Execute tools from StackOne.
    
    Args:
        account_id: The StackOne account ID to use
        action: The action/tool to execute (use '*' to list all available tools)
        parameters: Optional parameters to pass to the tool
    
    Returns:
        The result of executing the StackOne tool
    """
    try:
        # Initialize StackOneToolSet with API key from environment
        
        toolset = StackOneToolSet(api_key=api_key)
        tools = toolset.get_tools("*", account_id=account_id)
        
        # If requesting all tools, return the list
        if action == "*":
            tool_names = [tool.get("name", "unknown") for tool in tools]
            return f"Available StackOne tools: {', '.join(tool_names)}"
        
        # Find and execute the specific tool
        for tool in tools:
            if tool.get("name") == action or tool.get("identifier") == action:
                if parameters:
                    result = tool.execute(**parameters)
                else:
                    result = tool.execute()
                return f"Tool '{action}' executed successfully: {result}"
        
        return f"Tool '{action}' not found in StackOne toolset."
        
    except Exception as e:
        return f"Error executing StackOne tool: {str(e)}"


@tool("StackOne List Tools")
def stackone_list_tools(account_id: str) -> str:
    """
    List all available tools from StackOne for the given account.
    
    Args:
        account_id: The StackOne account ID
    
    Returns:
        A list of available tools and their descriptions
    """
    try:
        # Initialize StackOneToolSet with API key from environment
        toolset = StackOneToolSet(api_key=api_key)
        tools = toolset.get_tools("*", account_id=account_id)
        
        tool_list = []
        for tool in tools:
            tool_info = {
                "name": tool.get("name", "unknown"),
                "description": tool.get("description", "No description"),
            }
            tool_list.append(tool_info)
        
        return f"Available tools: {tool_list}"
        
    except Exception as e:
        return f"Error listing StackOne tools: {str(e)}"