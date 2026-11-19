import React from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

export const FlowingArrowEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Calculate dynamic count and speed based on connection length
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy);

  // 2 to 6 arrows depending on line length
  const arrowCount = Math.max(2, Math.min(6, Math.floor(distance / 85)));
  // Duration between 1.6s and 3.2s for consistent visual flow speed
  const duration = Math.max(1.6, Math.min(3.2, distance / 110));

  const arrows = Array.from({ length: arrowCount }, (_, i) => {
    const begin = -(i * duration) / arrowCount;
    return { id: i, begin: `${begin.toFixed(2)}s` };
  });

  return (
    <>
      {/* Base connection wire */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#FF4438' : '#64748B',
          strokeWidth: selected ? 2.5 : 2,
          strokeLinecap: 'round',
          ...style
        }}
      />

      {/* Interactive hover hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      {/* Moving arrows along the path in the direction of the flow */}
      <g className="flowing-arrows pointer-events-none">
        {arrows.map((arrow) => (
          <g key={`${id}_arr_${arrow.id}`}>
            {/* Aerodynamic Arrowhead pointing in +X (aligned with curve tangent) */}
            <path
              d="M -6 -4.5 L 3 0 L -6 4.5 L -3.5 0 Z"
              fill={selected ? '#FF4438' : '#FF4438'}
              stroke="#0f172a"
              strokeWidth="0.8"
              strokeLinejoin="round"
            >
              <animateMotion
                path={edgePath}
                dur={`${duration}s`}
                repeatCount="indefinite"
                rotate="auto"
                begin={arrow.begin}
              />
            </path>
          </g>
        ))}
      </g>
    </>
  );
};
