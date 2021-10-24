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

type PixelMapping = number[]

function indexGuard(idx: number) : number|undefined {
  return (idx === -1) ? undefined : idx
}

export class WledDevice {
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