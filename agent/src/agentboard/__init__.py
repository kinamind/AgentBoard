"""AgentBoard agent-side client and reporter.

Public surface:
    from agentboard import AgentBoardClient
"""

from .client import AgentBoardClient, AgentBoardError

__all__ = ["AgentBoardClient", "AgentBoardError"]
__version__ = "0.1.0"
