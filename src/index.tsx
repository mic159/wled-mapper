import React, {Fragment, useState, useEffect, useCallback} from "react"
import {render} from "react-dom"

import { Container, Header, Statistic } from 'semantic-ui-react'
import { MappingCanvas, NodeConfig } from './mapper'

import 'fomantic-ui-css/semantic.css'
import logo from "../static/001_cheerful.png"

interface Pin {
  start: number
  len: number
  order: number
  rev: boolean
}

interface LedCfg {
  total: number
  ins: Pin[]
}

interface WledConfig {
  hw: {
    led: LedCfg
  }
}

type PixelMapping = number[]

function indexGuard(idx: number) : number|undefined {
  return (idx === -1) ? undefined : idx
}

class WledDevice {
  ip: string;
  config?: WledConfig;
  pixelMapping?: PixelMapping;
  fetchInProgress: boolean = false;

  constructor(ip: string) {
    this.ip = ip
  }

  fetch(path: string, opts?) {
    const url = new URL(path, `http://${this.ip}/`)
    return fetch(url.toString(), opts).then(resp => (resp.json()))
  }

  async refreshConfig(): Promise<void> {
    const result = await this.fetch("cfg.json")
    if (result.rev?.length !== 2 || result.rev[0] !== 1 || result.rev[1] !== 0) {
      throw new Error("Bad config")
    }
    this.config = result
  }

  getPinMapping(): LedCfg|undefined {
    return this.config?.hw?.led
  }

  async getLedMapping(): Promise<void> {
    try {
      const result = await this.fetch("edit?edit=ledmap.json")
      console.log("Current mapping", result)
      this.pixelMapping = result.map
    } catch (err) {
      console.warn("No mapping")
      return
    }
  }

  generateNodes(): NodeConfig[] {
    const total = this.getPinMapping().total
    const existingMap: NodeConfig[] = this.pixelMapping?.map(
      (ledIndex, posIndex) => ({ledIndex, posIndex})
    ).sort((a, b) => (a.ledIndex - b.ledIndex)) ?? []
    return [...Array(total)].map((_, i) => {
      if (i < existingMap.length) return existingMap[i]
      return {
        ledIndex: i,
        posIndex: i,
      }
    })
  }

  genTimestamp(): number {
    return Math.floor(Date.now()/1e3)
  }

  highlightPixel(ledIndex: number): void {
    if (this.fetchInProgress) {return}
    this.fetchInProgress = true
    // Segments work after the mapping, so we need to referse the mapping to highlight the right pixel.
    const posIndex = indexGuard(this.pixelMapping?.indexOf(ledIndex)) ?? ledIndex
    const body = {
      seg: {id: 1, start: posIndex, stop: posIndex+1, grp: 1, spc: 0, of: 0}, v: true, time: this.genTimestamp()
    }
    this.fetch("json/si", {method: 'POST', body: JSON.stringify(body)})
      .then(() => {
        this.fetchInProgress = false
      })
      .catch((err) => {
        console.error(err)
        this.fetchInProgress = false
      })
  }
}

const IP = "10.10.1.193"//"10.10.1.27"
const device: WledDevice = window.device ?? new WledDevice(IP)
window.device = device



const App = () => {
  const [connected, setConnected] = useState<boolean>(device.config !== undefined)

  useEffect(async () => {
    if (!connected) {
      await Promise.all([device.refreshConfig(), device.getLedMapping()])
      setConnected(true)
    }
  }, [])

  const setHighlight = useCallback((idx: number|null) => {
    device.highlightPixel(idx)
  })

  return (
    <Fragment>
      <Container>
        <Header>
          <img src={logo} width="24" height="24" /> WLED Mapper {connected ? '🟢' : '🔴'}
        </Header>
        {!connected ? (
          <p>Connecting...</p>
        ): (
          <>
            <Statistic label="LEDs" value={device.getPinMapping().total} />

            <MappingCanvas initialConfig={device.generateNodes()} highlightNode={setHighlight} />
          </>
        )}
      </Container>
    </Fragment>
  )
}

render(<App />, document.getElementById("app"))
