import React, { useState, useCallback, useEffect, useMemo } from "react"

import { Stage, Layer, Circle, Group, Text } from 'react-konva'


export interface NodeConfig {
  ledIndex: number
  posIndex: number
}

interface DraggableNode extends NodeConfig {
  x: number
  y: number
}

interface Props {
  initialConfig: NodeConfig[]
  highlightNode: (idx: number) => void
  //saveData?: (DraggableNode[]) => void
}

const CIRCLE_RADIUS = 13;
const SPACING = 50;

function generatePositions(data: NodeConfig[]): DraggableNode[] {
  let verticalIndex = 0
  let prevPos = 0
  return data.sort((a, b) => a.ledIndex - b.ledIndex).map((node) => {
    if (node.posIndex < prevPos) {
      verticalIndex += 1
    }
    prevPos = node.posIndex
    return {
      ...node,
      x: 25 + node.posIndex * SPACING,
      y: 25 + verticalIndex * SPACING,
    }
  })
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

export const MappingCanvas = ({initialConfig, highlightNode}: Props) => {
  const [highlightedNode, setHighlightNode] = useState<number|null>(null)
  const initialPositions = useMemo(() => generatePositions(initialConfig), [initialConfig])
  const [nodes, setNodes] = useState<DraggableNode[]>(initialPositions)

  useEffect(() => {
    highlightNode(highlightedNode)
  }, [highlightedNode, highlightNode])

  const handleDragStart = useCallback((e) => {
    const id = parseInt(e.target.id())
    setHighlightNode(id)
  })
  const handleDragEnd = useCallback((e) => {
    const ledIndex = parseInt(e.target.id())
    const pos = e.target.absolutePosition().x
    const newPosIndex = Math.min(Math.max(Math.round((pos - 25) / SPACING), 0), nodes.length)
    setNodes(generatePositions(moveNode(nodes, ledIndex, newPosIndex)))
  })
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
  })
  const handleHighlight = useCallback((e) => {
    setHighlightNode(parseInt(e.currentTarget.id()))
  })

  const height = Math.max(...nodes.map((node) => node.y)) + 50
  const width = Math.max(...nodes.map((node) => node.x)) + 50

  return (
    <Stage width={width} height={height}>
      <Layer>
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
