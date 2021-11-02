import React, {Fragment, useState, useEffect, useCallback} from "react"
import {render} from "react-dom"

import { Modal, Menu, Button, Header as SemanticHeader, Icon, Form, Message } from 'semantic-ui-react'
import { MappingCanvas } from './mapper'
import { FakeDevice, WledDevice, Device, DeviceType } from "./device"

import 'fomantic-ui-css/semantic.css'
import logo from "../static/001_cheerful.png"
import { NodeConfig } from "./types"

const IP = "10.10.1.193"//"10.10.1.27"

const ConnectModal = ({handleConnect, error, loading}) => (
  <Modal
    trigger={<Button>Connect</Button>}
    closeIcon
    as={Form}
    onSubmit={handleConnect}
    error={!!error}
  >
    <Modal.Header>Connect to WLED</Modal.Header>
    <Modal.Content>
      <Modal.Description>
        <Form.Input
          fluid
          label="IP Address"
          name="ip_address"
          placeholder={IP}
          loading={loading}
          readOnly={loading}
          required
        />
        {error && (
          <Message
            error
            header="Connection Error"
            content={error}
          />
        )}
      </Modal.Description>
    </Modal.Content>
    <Modal.Actions>
      <Button type="submit" primary disabled={loading}>Connect</Button>
    </Modal.Actions>
  </Modal>
)

const StandaloneModal = ({handleStandalone}) => (
  <Modal
    trigger={<Button>Standalone</Button>}
    closeIcon
    as={Form}
    onSubmit={handleStandalone}
  >
    <Modal.Header>Standalone</Modal.Header>
    <Modal.Content>
      <Modal.Description>
        <Form.Input
          fluid
          label="Num LEDs"
          name="count"
          type="tel"
          pattern="[0-9]+"
          placeholder="18"
          required
        />
        <Form.TextArea label='About' placeholder='Tell us more about you...' />
      </Modal.Description>
    </Modal.Content>
    <Modal.Actions>
      <Button type="submit" primary>Start</Button>
    </Modal.Actions>
  </Modal>
)

const SaveModal = ({device, mapping}: {mapping: NodeConfig[], device: Device}) => {
  const data = [...mapping].sort((a, b) => a.posIndex - b.posIndex).map(node => node.ledIndex)
  const json = JSON.stringify({map: data})
  return (
    <Modal
      trigger={<Menu.Item>Save</Menu.Item>}
      closeIcon
      as={Form}
    >
      <Modal.Header>Save Mapping</Modal.Header>
      <Modal.Content>
        <Modal.Description>
          {device.type === DeviceType.WLED && (
            <Message>test</Message>
          )}
          <Form.TextArea value={json} />
        </Modal.Description>
      </Modal.Content>
    </Modal>
  )
}

const App = () => {
  const [device, setDevice] = useState<Device|null>(window.device ?? null)
  const [connected, setConnected] = useState<boolean>(device && device.config !== undefined)
  const [error, setError] = useState<string|null>(null)
  const [mapping, setMapping] = useState<NodeConfig[]>([])

  useEffect(() => {
    if (!connected && device) {
      device.connect().then(() => {
        setConnected(true)
      })
    }
  }, [])

  useEffect(() => {
    if (mapping.length === 0 && device && device.generateNodes().length !== 0) {
      setMapping(device.generateNodes())
    }
  }, [device, setMapping, mapping])

  const setHighlight = useCallback((idx: number|null) => {
    device.highlightPixel(idx)
  }, [device])

  const writeLedMapping = useCallback((newConfig: NodeConfig[]) => {
    setMapping(newConfig)
    //device.writeLedMapping(data)
  }, [device])

  const handleConnect = useCallback((event) => {
    const formData = new FormData(event.target);
    const ip = formData.get('ip_address') as string
    const device = new WledDevice(ip)
    setDevice(device)
    window.device = device
    device.connect()
      .catch((err) => {
        setDevice(null)
        window.device = null
        setError(err.toString())
        return false
      })
      .then((res) => setConnected(res !== false))
  }, [])

  const handleStandalone = useCallback((event) => {
    const formData = new FormData(event.target);
    const numLeds = formData.get('count') as string
    const device = new FakeDevice(parseInt(numLeds))
    setDevice(device)
    setConnected(true)
    window.device = device
  }, [])

  return (
    <Fragment>
      <Menu inverted fluid>
        <Menu.Item header>
          <img src={logo} />&nbsp;WLED<br/>Mapper
        </Menu.Item>
        <div className="menu right">
          {connected && (
            <SaveModal
              device={device}
              mapping={mapping}
            />
          )}
        </div>
      </Menu>
      {!connected ? (
        <Fragment>
          <SemanticHeader as="h2" icon aligh="center" style={{display: "block"}}>
            <Icon name="plug" />
            Disconnected
            <SemanticHeader.Subheader>
              <Button.Group>
                <ConnectModal 
                  handleConnect={handleConnect}
                  error={error}
                  loading={device && !connected}
                />
                <Button.Or />
                <StandaloneModal handleStandalone={handleStandalone} />
              </Button.Group>
            </SemanticHeader.Subheader>
          </SemanticHeader>
        </Fragment>
      ): (
        <MappingCanvas
          initialConfig={device.generateNodes()}
          highlightNode={setHighlight}
          writeLedMapping={writeLedMapping}
        />
      )}
    </Fragment>
  )
}

render(<App />, document.getElementById("app"))
