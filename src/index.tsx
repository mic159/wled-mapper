import React, {Fragment, useState, useEffect, useCallback} from "react"
import {render} from "react-dom"

import { Container, Header, Statistic, Menu } from 'semantic-ui-react'
import { MappingCanvas } from './mapper'
import { WledDevice } from "./device"

import 'fomantic-ui-css/semantic.css'
import logo from "../static/001_cheerful.png"

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
      <Menu inverted fluid>
        <Menu.Item header>
          <img src={logo} />&nbsp;WLED<br/>Mapper
        </Menu.Item>
        <div className="menu right">
          <Menu.Item>{connected ? `${device.getPinMapping().total.toString()} 🟢` : 'Disconnected 🔴'}</Menu.Item>
        </div>
      </Menu>
      {!connected ? (
        <p>Connecting...</p>
      ): (
        <MappingCanvas initialConfig={device.generateNodes()} highlightNode={setHighlight} />
      )}
    </Fragment>
  )
}

render(<App />, document.getElementById("app"))
