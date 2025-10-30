from os import getenv
from typing import Sequence

from crewai.tools import tool
from stackone_ai import StackOneToolSet

from .models import to_crewai

@tool("StackOne")
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

