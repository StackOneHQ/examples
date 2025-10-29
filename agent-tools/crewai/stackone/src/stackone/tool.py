from crewai.tools import tool
from stackone_ai import StackOneToolSet
from typing import Dict, Any


# Export all tools as a Stackone class/object for CrewAI compatibility
class Stackone:
    """StackOne tools collection for CrewAI"""
    meta_execute_tool = None
    meta_list_tools = None
    meta_search_tools = None


@tool("StackOne Meta Tool Executor")
def stackone_meta_execute_tool(account_id: str, action: str, parameters: dict = None, filter: str = "*") -> str:
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
        
        toolset = StackOneToolSet()
        tools = toolset.get_tools(filter, account_id=account_id)
        meta_tools = tools.meta_tools()

        execute_tool = meta_tools.get_tool("meta_execute_tool")
        result = execute_tool.call(toolName=action, params=parameters, account_id=account_id)
        return result
        
    except Exception as e:
        return f"Error executing StackOne tool: {str(e)}"


@tool("StackOne Meta List Tools")
def stackone_meta_list_tools(account_id: str, filter: str = "*") -> str:
    """
    List all available tools from StackOne for the given account.
    
    Args:
        account_id: The StackOne account ID
    
    Returns:
        A list of available tools and their descriptions
    """
    try:
        # Initialize StackOneToolSet with API key from environment
        toolset = StackOneToolSet()
        tools = toolset.get_tools(filter, account_id=account_id).meta_tools()
        
        # Debug: print the tools object and its type
        print(f"Debug - tools type: {type(tools)}")
        print(f"Debug - tools content: {tools}")
        print(f"Debug - tools dir: {dir(tools)}")
        if hasattr(tools, '__iter__'):
            print(f"Debug - tools is iterable, iterating...")
        
        tool_list = []

        for tool in tools:
            # Debug: print each tool
            print(f"Debug - tool type: {type(tool)}, tool: {tool}")
            tool_info = {
                "name": tool.get("name", "unknown"),
                "description": tool.get("description", "No description"),
            }
            tool_list.append(tool_info)
        
        return f"Available tools: {tool_list}"
        
    except Exception as e:
        return f"Error listing StackOne tools: {str(e)}"

@tool("StackOne Meta Search Tools")
def stackone_meta_search_tools(account_id: str, filter: str = "*", query: str = None) -> str:
    """
    Search for tools from StackOne for the given account.
    
    Args:
        account_id: The StackOne account ID
        query: The query to search for
    """
    try:
        toolset = StackOneToolSet()
        tools = toolset.get_tools(filter, account_id=account_id)
        filtered_tools = tools.meta_tools().get_tool("meta_search_tools").call(query=query, limit=5, account_id=account_id)
        return f"Found {len(filtered_tools)} tools: {filtered_tools}"
    except Exception as e:
        return f"Error searching for StackOne tools: {str(e)}"


# Assign tools to Stackone class for CrewAI compatibility
Stackone.meta_execute_tool = stackone_meta_execute_tool
Stackone.meta_list_tools = stackone_meta_list_tools
Stackone.meta_search_tools = stackone_meta_search_tools