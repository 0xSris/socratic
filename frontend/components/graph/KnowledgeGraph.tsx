'use client'
import { useEffect, useRef, useState } from 'react'
import { GraphNode, GraphEdge, useSession } from '@/lib/useSession'

const STATE_COLORS: Record<string, { fill: string; stroke: string; glow: string; text: string }> = {
  unknown:   { fill: 'rgba(255,255,255,0.04)', stroke: 'rgba(255,255,255,0.12)', glow: 'none', text: 'rgba(255,255,255,0.25)' },
  inferred:  { fill: 'rgba(14,116,144,0.15)',  stroke: '#0e7490', glow: '0 0 10px rgba(14,116,144,0.4)', text: '#67e8f9' },
  shaky:     { fill: 'rgba(146,64,14,0.18)',   stroke: '#b45309', glow: '0 0 10px rgba(180,83,9,0.4)',   text: '#fcd34d' },
  confident: { fill: 'rgba(30,58,138,0.3)',    stroke: '#2563eb', glow: '0 0 14px rgba(37,99,235,0.5)', text: '#93c5fd' },
  mastered:  { fill: 'rgba(49,46,129,0.35)',   stroke: '#6366f1', glow: '0 0 18px rgba(99,102,241,0.6)', text: '#a5b4fc' },
}

const EDGE_COLORS: Record<string, string> = {
  requires: 'rgba(99,102,241,0.2)',
  related:  'rgba(34,211,238,0.15)',
  extends:  'rgba(251,191,36,0.15)',
}

const NODE_RADIUS = 32

interface Props {
  width?: number
  height?: number
  className?: string
}

export default function KnowledgeGraph({ width = 1000, height = 700, className = '' }: Props) {
  const { nodes, edges, highlightedNode, setHighlightedNode } = useSession()
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null)
  const [animatedNodes, setAnimatedNodes] = useState<Set<string>>(new Set())
  const prevNodesRef = useRef<Record<string, string>>({})

  // Detect state changes to animate newly updated nodes
  useEffect(() => {
    const newAnimated = new Set<string>()
    nodes.forEach(n => {
      const prev = prevNodesRef.current[n.name]
      if (prev && prev !== n.state) {
        newAnimated.add(n.name)
      }
      prevNodesRef.current[n.name] = n.state
    })
    if (newAnimated.size > 0) {
      setAnimatedNodes(newAnimated)
      setTimeout(() => setAnimatedNodes(new Set()), 2000)
    }
  }, [nodes])

  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-center">
          <div className="w-24 h-24 rounded-full border border-white/5 mx-auto mb-4 flex items-center justify-center animate-pulse-slow">
            <div className="w-12 h-12 rounded-full border border-white/10" />
          </div>
          <p className="text-white/15 font-mono text-xs tracking-widest uppercase">Awaiting session</p>
        </div>
      </div>
    )
  }

  // Scale node positions to fit canvas with padding
  const padding = 80
  const xs = nodes.map(n => n.x ?? 500)
  const ys = nodes.map(n => n.y ?? 350)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scaleX = (x: number) => padding + ((x - minX) / rangeX) * (width - padding * 2)
  const scaleY = (y: number) => padding + ((y - minY) / rangeY) * (height - padding * 2)

  const nodeMap: Record<string, { sx: number; sy: number; node: GraphNode }> = {}
  nodes.forEach(n => {
    nodeMap[n.name] = { sx: scaleX(n.x ?? 500), sy: scaleY(n.y ?? 350), node: n }
  })

  return (
    <div className={`relative select-none ${className}`} style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0"
      >
        <defs>
          {/* Glow filters per state */}
          {(['inferred', 'shaky', 'confident', 'mastered'] as const).map(state => (
            <filter key={state} id={`glow-${state}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur
                stdDeviation={state === 'mastered' ? '5' : state === 'confident' ? '4' : '3'}
                result="coloredBlur"
              />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(99,102,241,0.3)" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const src = nodeMap[edge.source]
          const tgt = nodeMap[edge.target]
          if (!src || !tgt) return null

          // Stop line at node circumference
          const dx = tgt.sx - src.sx
          const dy = tgt.sy - src.sy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const x1 = src.sx + (dx / dist) * NODE_RADIUS
          const y1 = src.sy + (dy / dist) * NODE_RADIUS
          const x2 = tgt.sx - (dx / dist) * (NODE_RADIUS + 6)
          const y2 = tgt.sy - (dy / dist) * (NODE_RADIUS + 6)

          const color = EDGE_COLORS[edge.relation] || EDGE_COLORS.requires

          return (
            <g key={i}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={edge.relation === 'related' ? '4 4' : 'none'}
                markerEnd="url(#arrowhead)"
                className="transition-all duration-500"
              />
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = nodeMap[node.name]
          if (!pos) return null
          const colors = STATE_COLORS[node.state] || STATE_COLORS.unknown
          const isHighlighted = highlightedNode === node.name
          const isAnimating = animatedNodes.has(node.name)
          const isMastered = node.state === 'mastered'
          const radius = isHighlighted ? NODE_RADIUS + 5 : NODE_RADIUS

          return (
            <g
              key={node.name}
              transform={`translate(${pos.sx},${pos.sy})`}
              className="cursor-pointer"
              onMouseEnter={() => {
                setHighlightedNode(node.name)
                setTooltip({ x: pos.sx, y: pos.sy, node })
              }}
              onMouseLeave={() => {
                setHighlightedNode(null)
                setTooltip(null)
              }}
              style={{ transition: 'all 0.4s ease' }}
            >
              {/* Outer glow ring for mastered/confident */}
              {(isMastered || node.state === 'confident') && (
                <circle
                  r={radius + 8}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={0.5}
                  opacity={0.3}
                  className={isMastered ? 'animate-pulse-slow' : ''}
                />
              )}

              {/* Animation burst on state change */}
              {isAnimating && (
                <circle
                  r={radius + 16}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={1}
                  opacity={0}
                  style={{
                    animation: 'fadeIn 0.3s ease-out, pulse 1.5s ease-out forwards',
                  }}
                />
              )}

              {/* Main node circle */}
              <circle
                r={radius}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isHighlighted ? 2 : 1}
                filter={node.state !== 'unknown' ? `url(#glow-${node.state})` : undefined}
                style={{ transition: 'all 0.4s ease' }}
              />

              {/* Confidence fill arc */}
              {node.confidence > 0 && (
                <circle
                  r={radius - 4}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={3}
                  strokeDasharray={`${node.confidence * 2 * Math.PI * (radius - 4)} ${2 * Math.PI * (radius - 4)}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                  opacity={0.5}
                  transform="rotate(-90)"
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
              )}

              {/* Label */}
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill={colors.text}
                fontSize={node.name.length > 12 ? '9' : node.name.length > 8 ? '10' : '11'}
                fontFamily="var(--font-mono)"
                fontWeight="400"
                style={{ transition: 'fill 0.4s ease', userSelect: 'none' }}
              >
                {node.name.length > 14
                  ? node.name.split(' ').map((w, i) => (
                      <tspan key={i} x="0" dy={i === 0 ? '-0.5em' : '1.2em'}>{w}</tspan>
                    ))
                  : node.name}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none glass rounded-lg p-3 w-52 z-20 animate-fade-in"
          style={{
            left: Math.min(tooltip.x + 20, width - 220),
            top: Math.max(tooltip.y - 60, 10),
          }}
        >
          <p className="font-mono text-xs text-white/80 font-medium mb-1">{tooltip.node.name}</p>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono pill-${tooltip.node.state}`}>
              {tooltip.node.state}
            </span>
            <span className="text-[10px] font-mono text-white/30">
              {Math.round(tooltip.node.confidence * 100)}%
            </span>
          </div>
          {tooltip.node.evidence && (
            <p className="text-[10px] text-white/30 italic leading-snug mt-1">
              "{tooltip.node.evidence.slice(0, 80)}..."
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
        {Object.entries(STATE_COLORS).map(([state, colors]) => (
          <div key={state} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full border"
              style={{ background: colors.fill, borderColor: colors.stroke }}
            />
            <span className="text-[10px] font-mono" style={{ color: colors.text }}>
              {state}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
