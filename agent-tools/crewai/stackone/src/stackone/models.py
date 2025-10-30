from typing import Any, Sequence, Optional
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool
from enum import Enum

class ParameterLocation(str, Enum):
    """Valid locations for parameters in requests"""

    HEADER = "header"
    QUERY = "query"
    PATH = "path"
    BODY = "body"
    FILE = "file"  # For file uploads

def to_langchain(self) -> BaseTool:
        """Convert this tool to LangChain format

        Returns:
            Tool in LangChain format
        """
        # Create properly annotated schema for the tool
        schema_props: dict[str, Any] = {}
        annotations: dict[str, Any] = {}

        for name, details in self.parameters.properties.items():
            # Skip x-account-id as it's handled automatically via headers
            if name == "x-account-id":
                continue

            python_type: type = str
            if isinstance(details, dict):
                type_str = details.get("type", "string")
                if type_str == "number":
                    python_type = float
                elif type_str == "integer":
                    python_type = int
                elif type_str == "boolean":
                    python_type = bool

                # Determine if field is required
                # Path parameters are always required (they're in the URL)
                # Query, header, and body parameters are optional unless explicitly required
                param_location = self._execute_config.parameter_locations.get(name)
                is_required = param_location == ParameterLocation.PATH or details.get("required", False)

                if is_required:
                    field = Field(description=details.get("description", ""))
                    annotations[name] = python_type
                else:
                    field = Field(default=None, description=details.get("description", ""))
                    annotations[name] = Optional[python_type]
            else:
                field = Field(default=None, description="")
                annotations[name] = Optional[str]

            schema_props[name] = field

        # Create the schema class with proper annotations
        schema_class = type(
            f"{self.name.title().replace('_', '')}Args",
            (BaseModel,),
            {
                "__annotations__": annotations,
                "__module__": __name__,
                **schema_props,
            },
        )

        parent_tool = self

        class StackOneLangChainTool(BaseTool):
            name: str = parent_tool.name
            description: str = parent_tool.description
            args_schema: type[BaseModel] = schema_class
            func = staticmethod(parent_tool.execute)  # Required by CrewAI

            def _run(self, **kwargs: Any) -> Any:
                return parent_tool.execute(kwargs)

            async def _arun(self, **kwargs: Any) -> Any:
                return self._run(**kwargs)

        return StackOneLangChainTool()

def to_crewai(self) -> Sequence[Any]:
        """Convert all tools to CrewAI format

        CrewAI requires tools to be instances of crewai.tools.base_tool.BaseTool,
        not LangChain's BaseTool. This method wraps LangChain tools appropriately.

        Returns:
            Sequence of tools in CrewAI format

        Raises:
            ImportError: If crewai is not installed
        """
        try:
            from crewai.tools.base_tool import BaseTool as CrewAIBaseTool
        except ImportError as e:
            raise ImportError(
                "CrewAI is required to convert tools to CrewAI format. "
                "Install it with: pip install 'stackone-ai[examples]'"
            ) from e

        def create_crewai_wrapper(langchain_tool_instance: BaseTool) -> CrewAIBaseTool:
            """Create a CrewAI wrapper for a LangChain tool using closure to preserve reference.

            Uses closure to capture the langchain tool since Pydantic models may reset instance attributes.
            """
            class CrewAIToolWrapper(CrewAIBaseTool):
                """Wrapper to convert LangChain tools to CrewAI format"""

                def _run(self, **kwargs: Any) -> Any:
                    """Execute the wrapped LangChain tool"""
                    return langchain_tool_instance.run(kwargs)

            return CrewAIToolWrapper(
                name=langchain_tool_instance.name,
                description=langchain_tool_instance.description,
                args_schema=langchain_tool_instance.args_schema,
            )

        return [create_crewai_wrapper(tool) for tool in self.to_langchain()]
