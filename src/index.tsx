import React, {Fragment, useState, useEffect, useCallback} from "react"
import {render} from "react-dom"

import { Modal, Menu, Button, Header as SemanticHeader, Icon, Form, Message, Divider } from 'semantic-ui-react'
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

function validateJson(data: string): boolean {
  try {
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed.map) && parsed.map.length > 0 && parsed.map.every(e => typeof e === 'number')) {
      return true
    } else {
      return false
    }
  } catch(e) {
    return false
  }
}

const StandaloneModal = ({handleStandalone}) => {
  const [error, setError] = useState<boolean>(false)
  const onSubmit = useCallback((event) => {
    const formData = new FormData(event.target)
    const numLeds = formData.get('count') as string|null
    const mapping = formData.get('mapping') as string|null
    if (!numLeds && !mapping) {
      setError(true)
    } else if (numLeds && isNaN(parseInt(numLeds))) {
      setError(true)
    } else if (numLeds && parseInt(numLeds) < 0) {
      setError(true)
    } else if (mapping && !validateJson(mapping)) {
      setError(true)
    } else {
      setError(false)
      handleStandalone(event)
    }
  }, [setError, handleStandalone])
  return (
    <Modal
      trigger={<Button>Standalone</Button>}
      closeIcon
      as={Form}
      onSubmit={onSubmit}
      error={error}
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
          />
          <Divider content="OR" horizontal />
          <Form.TextArea
            label="ledmap.json"
            name="mapping"
            placeholder={'{"map": [1,2,3,4,5]}'}
          />
          <Message error content="Please enter one of the above" />
        </Modal.Description>
      </Modal.Content>
      <Modal.Actions>
        <Button type="submit" primary>Start</Button>
      </Modal.Actions>
    </Modal>
  )
}

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
            <Message warning>
              <Message.Header>Action Needed</Message.Header>
              After writing the new mapping, you need to press "save" in the LED configuration page.
            </Message>
          )}
          <Form.TextArea value={json} />
        </Modal.Description>
      </Modal.Content>
      {device.type === DeviceType.WLED && (
        <Modal.Actions>
          <Button primary>Write</Button>
        </Modal.Actions>
      )}
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

  const updateLedMapping = useCallback((newConfig: NodeConfig[]) => {
    setMapping(newConfig)
    //device.writeLedMapping(data)
  }, [setMapping])

  const handleConnect = useCallback((event) => {
    const formData = new FormData(event.target)
    const ip = formData.get('ip_address') as string|null
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
    const formData = new FormData(event.target)
    const numLeds = formData.get('count') as string|null
    const mapping = formData.get('mapping') as string|null
    const device = new FakeDevice(numLeds, mapping)
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
          writeLedMapping={updateLedMapping}
        />
      )}
    </Fragment>
  )
}

render(<App />, document.getElementById("app"))
