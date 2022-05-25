import { NodeConfig } from './types'

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

interface LedMapJson {
  map: number[]
}

function indexGuard(idx: number) : number|undefined {
  return (idx === -1) ? undefined : idx
}

export function isEqual(a: LedMapJson, b: LedMapJson): boolean {
  if (typeof a === 'undefined' || typeof b === 'undefined') {
    return false
  }
  return a.map.length === b.map.length && a.map.every((value, index) => value === b.map[index])
}

export enum DeviceType {
  WLED = 'WLED',
  Fake = 'Fake'
}

export abstract class Device {
  type: DeviceType
  abstract connect(): Promise<[void, void]>
  abstract highlightPixel(ledIndex: number): void
  abstract generateNodes(): NodeConfig[]
  abstract writeLedMapping(newConfig: NodeConfig[]): Promise<void>
  abstract hasChanges(newConfig: NodeConfig[]): boolean
  convertToJSON(mapping: NodeConfig[]): LedMapJson {
    const data = [...mapping].sort((a, b) => a.posIndex - b.posIndex).map(node => node.ledIndex)
    return {map: data}
  }
}

export class WledDevice extends Device {
  type = DeviceType.WLED
  ip: string
  config?: WledConfig
  pixelMapping?: LedMapJson
  fetchInProgress: boolean = false

  constructor(ip: string) {
    super()
    this.ip = ip
  }

  getUrl(path: string): string {
    const url = new URL(path, `http://${this.ip}/`)
    return url.toString()
  }

  fetch(path: string, fetchOpts?, json = true) {
    const promise = fetch(this.getUrl(path), fetchOpts)
      .then(response => {
        if (!response.ok) {
          throw Error(response.statusText)
        }
        return response
      })
    if (json) {
      return promise.then(resp => (resp.json()))
    }
    return promise
  }

  async refreshConfig(): Promise<void> {
    const result = await this.fetch("/cfg.json")
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
      const result = await this.fetch("/edit?edit=ledmap.json")
      this.pixelMapping = result
    } catch (err) {
      console.warn("No mapping", err)
      return
    }
  }

  connect(): Promise<[void, void]> {
    return Promise.all([this.refreshConfig(), this.getLedMapping()])
  }

  hasChanges(newConfig: NodeConfig[]): boolean {
    const data = this.convertToJSON(newConfig)
    return !isEqual(data, this.pixelMapping)
  }

  async writeLedMapping(newConfig: NodeConfig[]): Promise<void> {
    const data = this.convertToJSON(newConfig)
    if (isEqual(data, this.pixelMapping)) {
      return
    }
    const form = new FormData()
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'})
    form.append("data", blob, 'ledmap.json')
    const result = await this.fetch(
      "/edit",
      {method: 'POST', body: form},
      false
    )
    if (!result.ok) {
      debugger
    }
    this.pixelMapping = data
  }

  generateNodes(): NodeConfig[] {
    const total = this.getPinMapping()?.total
    if (!total) return []
    const existingMap: NodeConfig[] = this.pixelMapping?.map.map(
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
    const posIndex = indexGuard(this.pixelMapping?.map.indexOf(ledIndex)) ?? ledIndex
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

export class FakeDevice extends Device {
  type = DeviceType.Fake
  numLeds: number
  pixelMapping?: LedMapJson

  constructor(numLeds: string|null, pixelMapping: string|null) {
    super()
    if (pixelMapping) {
      this.pixelMapping = JSON.parse(pixelMapping)
      this.numLeds = this.pixelMapping.map.length
    } else {
      this.numLeds = parseInt(numLeds)
      const data = [...Array(this.numLeds)].map((_, i) => {
        return {
          ledIndex: i,
          posIndex: i,
        }
      })
      this.pixelMapping = this.convertToJSON(data)
    }
  }

  connect(): Promise<[void, void]> {
    return new Promise((resolve) => resolve(undefined))
  }

  generateNodes(): NodeConfig[] {
    return this.pixelMapping.map.map(
      (ledIndex, posIndex) => ({ledIndex, posIndex})
    ).sort((a, b) => (a.ledIndex - b.ledIndex))
  }

  hasChanges(newConfig: NodeConfig[]): boolean {
    const data = this.convertToJSON(newConfig)
    return !isEqual(data, this.pixelMapping)
  }

  highlightPixel(ledIndex: number): void {}

  async writeLedMapping(newConfig: NodeConfig[]) {
    const data = this.convertToJSON(newConfig)
    this.pixelMapping = data
  }
}