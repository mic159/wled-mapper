import React, { useState, useCallback, useEffect, useMemo } from "react"
import { Stage, Layer, Circle, Group, Text, Line } from 'react-konva'

import { NodeConfig } from './types'


interface DraggableNode extends NodeConfig {
  x: number
  y: number
}

interface Props {
  initialConfig: NodeConfig[]
  highlightNode: (idx: number) => void
  writeLedMapping?: (data: NodeConfig[]) => void
}

const CIRCLE_RADIUS = 13;
const SPACING = 50;
const TOP_PADDING = 25;

function normalize(val: number): number {
  return Math.max(-1, Math.min(1, val))
}

function generatePositions(data: NodeConfig[]): DraggableNode[] {
  let verticalIndex = 0
  let prevPos = null
  let prevDir = null
  let prevCount = 0
  return (
    data
      .sort((a, b) => a.ledIndex - b.ledIndex)
      .map((node) => {
        const dir = prevPos === null ? null : normalize(node.posIndex - prevPos)
        if(prevDir !== null && dir !== prevDir && prevCount !== 0) {
          verticalIndex += 1
          prevDir = dir
          prevCount = 0
        } else {
          prevDir = dir
          prevCount += 1
        }
        prevPos = node.posIndex
        return {
          ...node,
          x: (SPACING / 2) + node.posIndex * SPACING,
          y: TOP_PADDING + (SPACING / 2) + verticalIndex * SPACING,
        }
      })
  )
}

function moveNode(data: DraggableNode[], ledIndex: number, newPos: number): DraggableNode[] {
  const oldPos = data.find((node) => node.ledIndex === ledIndex)?.posIndex
  const minAffected = Math.min(oldPos, newPos)
  const maxAffected = Math.max(oldPos, newPos)
  const adjust = oldPos < newPos ? -1 : 1
  return data.map((node) => {
    if (node.posIndex < minAffected) return node
    if (node.posIndex > maxAffected) return node
    return {
      ...node,
      posIndex: node.ledIndex === ledIndex ? newPos : node.posIndex + adjust
    }
  })
}

export const MappingCanvas = ({initialConfig, highlightNode, writeLedMapping}: Props) => {
  const [highlightedNode, setHighlightNode] = useState<number|null>(null)
  const initialPositions = useMemo(
    () => generatePositions(initialConfig),
    initialConfig.map(node => node.posIndex)
  )
  const [nodes, setNodes] = useState<DraggableNode[]>(initialPositions)

  useEffect(() => {
    highlightNode(highlightedNode)
  }, [highlightedNode, highlightNode])

  const handleDragStart = useCallback((e) => {
    const id = parseInt(e.target.id())
    setHighlightNode(id)
  }, [setHighlightNode])
  const handleDragEnd = useCallback((e) => {
    const ledIndex = parseInt(e.target.id())
    const pos = e.target.absolutePosition().x
    const newPosIndex = Math.min(Math.max(Math.round((pos - 25) / SPACING), 0), nodes.length - 1)
    const nodeConfigs = generatePositions(moveNode(nodes, ledIndex, newPosIndex))
    setNodes(nodeConfigs)
    writeLedMapping(nodeConfigs)
  }, [setNodes, writeLedMapping, nodes])
  const handleDragMove = useCallback((e) => {
    const id = parseInt(e.target.id())
    const pos = e.target.absolutePosition()
    setNodes(
      nodes.map((node) => {
        if (node.ledIndex === id) {
          return {
            ...node,
            x: pos.x,
            y: pos.y,
          }
        }
        return node;
      })
    )
  }, [setNodes, nodes])
  const handleHighlight = useCallback((e) => {
    setHighlightNode(parseInt(e.currentTarget.id()))
  }, [setHighlightNode])

  const height = Math.max(...nodes.map((node) => node.y)) + SPACING
  const width = Math.max(...nodes.map((node) => node.x)) + SPACING
  const barsX = initialConfig.length + 1
  const barsY = Math.ceil(height / SPACING)

  return (
    <Stage width={window.innerWidth} height={height} draggable>
      <Layer>
        {[...Array(barsX)].map((_, i) => (
          <Line key={i} y={0} x={i * SPACING} points={[0,0,0,height]} stroke="black" strokeWidth={1} opacity={0.3} />
        ))}
        {[...Array(barsY)].map((_, i) => (
          <Line key={i} y={TOP_PADDING + i * SPACING} x={0} points={[0,0,width,0]} stroke="black" strokeWidth={1} opacity={0.3} />
        ))}
        {[...Array(barsX - 1)].map((_, i) => (
          <Text
            key={i}
            text={i.toString()}
            align="center"
            verticalAlign="middle"
            width={SPACING}
            height={TOP_PADDING}
            y={0}
            x={i * SPACING}
            opacity={0.3}
            fontSize={12}
          />
        ))}
      </Layer>
      <Layer>
        <Line
          x={0}
          y={0}
          points={nodes.flatMap((node) => [node.x, node.y])}
          stroke="black"
        />
        {nodes.map((node) => (
          <Group
            key={node.ledIndex}
            id={node.ledIndex.toString()}
            x={node.x}
            y={node.y}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragMove={handleDragMove}
            onTouchStart={handleHighlight}
            onMouseEnter={handleHighlight}
          >
            <Circle
              radius={CIRCLE_RADIUS}
              fill={highlightedNode === node.ledIndex ? "green" : "red"}
              stroke="black"
              strokeWidth={1}
            />
            <Text
              text={node.ledIndex.toString()}
              align="center"
              verticalAlign="middle"
              width={CIRCLE_RADIUS*2}
              height={CIRCLE_RADIUS}
              x={-CIRCLE_RADIUS}
              y={-CIRCLE_RADIUS/2}
              fontSize={12}
            />
          </Group>
        ))}
      </Layer>
    </Stage>
  )
}
