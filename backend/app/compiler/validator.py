from typing import List, Set, Dict
from app.models.graph import GraphSchema, AuditReport, AuditIssue

def audit_graph(graph: GraphSchema) -> AuditReport:
    """
    Preflight Logical Process Audit with Maturity Score.
    Direct implementation of the BPMN Studio / SREDA AI validation pattern.
    """
    issues: List[AuditIssue] = []
    penalty_score = 0

    if not graph.nodes:
        return AuditReport(
            is_valid=False,
            maturity_score=0,
            issues=[
                AuditIssue(
                    severity="error",
                    node_id=None,
                    title="Empty Graph",
                    message="The canvas contains no nodes. Add a Start Node to begin."
                )
            ]
        )

    # 1. Start node analysis
    start_nodes = [n for n in graph.nodes if n.type == "start"]
    if not start_nodes:
        issues.append(
            AuditIssue(
                severity="error",
                node_id=None,
                title="Missing Start Node",
                message="Every bot must contain at least one Start / Command node as an entry point."
            )
        )
        penalty_score += 40

    # 2. Map edges
    incoming_edges: Dict[str, List[str]] = {n.id: [] for n in graph.nodes}
    outgoing_edges: Dict[str, List[str]] = {n.id: [] for n in graph.nodes}
    outgoing_handles: Dict[str, Set[str]] = {n.id: set() for n in graph.nodes}

    for edge in graph.edges:
        if edge.target in incoming_edges:
            incoming_edges[edge.target].append(edge.source)
        if edge.source in outgoing_edges:
            outgoing_edges[edge.source].append(edge.target)
        if edge.sourceHandle and edge.source in outgoing_handles:
            outgoing_handles[edge.source].add(edge.sourceHandle)

    # 3. Node-by-node validation
    for node in graph.nodes:
        # Check orphan nodes (nodes with no incoming connections, except start)
        if node.type != "start" and len(incoming_edges[node.id]) == 0:
            issues.append(
                AuditIssue(
                    severity="warning",
                    node_id=node.id,
                    title="Orphan Node",
                    message=f"Node '{node.data.label or node.id}' is disconnected and has no incoming path from Start."
                )
            )
            penalty_score += 10

        # Check Message node
        if node.type == "message":
            if not node.data.text or not node.data.text.strip():
                issues.append(
                    AuditIssue(
                        severity="error",
                        node_id=node.id,
                        title="Empty Message Text",
                        message=f"Node '{node.id}' has no message text to send to the user."
                    )
                )
                penalty_score += 15

            # Check buttons connectivity
            for idx, btn in enumerate(node.data.buttons):
                btn_handle = btn.target_handle or f"btn_{idx}"
                if btn.action_type == "callback" and btn_handle not in outgoing_handles[node.id]:
                    issues.append(
                        AuditIssue(
                            severity="warning",
                            node_id=node.id,
                            title="Unconnected Button",
                            message=f"Button '{btn.text}' in node '{node.id}' does not lead to any next step."
                        )
                    )
                    penalty_score += 8

        # Check Wait Input node
        if node.type == "input":
            if not node.data.variable_name:
                issues.append(
                    AuditIssue(
                        severity="error",
                        node_id=node.id,
                        title="Missing Variable Name",
                        message=f"Input node '{node.id}' requires a variable name to store user responses."
                    )
                )
                penalty_score += 15

            if len(outgoing_edges[node.id]) == 0:
                issues.append(
                    AuditIssue(
                        severity="warning",
                        node_id=node.id,
                        title="Dead End Input",
                        message=f"Input node '{node.id}' receives user data but has no next step connected."
                    )
                )
                penalty_score += 12

        # Check Notify Admin node
        if node.type == "notify_admin":
            if not node.data.admin_id or "YOUR_ADMIN_ID" in node.data.admin_id:
                issues.append(
                    AuditIssue(
                        severity="info",
                        node_id=node.id,
                        title="Placeholder Admin ID",
                        message="Please set your actual numeric Telegram User ID in the Notify Admin node."
                    )
                )
                penalty_score += 5

    has_errors = any(issue.severity == "error" for issue in issues)
    maturity_score = max(0, min(100, 100 - penalty_score))

    return AuditReport(
        is_valid=not has_errors,
        maturity_score=maturity_score,
        issues=issues
    )
