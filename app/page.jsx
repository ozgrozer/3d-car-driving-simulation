'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function DrivingSimulation () {
  const mountRef = useRef(null)

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb) // Sky blue background

    // Audio setup
    let audioContext
    let engineSound
    let brakeSound
    let engineGainNode
    let brakeGainNode
    let engineOscillator
    let isEngineSoundPlaying = false
    let isBrakeSoundPlaying = false

    // Initialize audio context
    function initAudio () {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()

      // Create engine sound (oscillator-based)
      engineGainNode = audioContext.createGain()
      engineGainNode.gain.value = 0
      engineGainNode.connect(audioContext.destination)

      // Create brake sound
      brakeGainNode = audioContext.createGain()
      brakeGainNode.gain.value = 0
      brakeGainNode.connect(audioContext.destination)
    }

    // Create and start engine sound
    function startEngineSound () {
      if (!audioContext) initAudio()

      if (!isEngineSoundPlaying) {
        // Create a new oscillator for the engine sound
        engineOscillator = audioContext.createOscillator()
        engineOscillator.type = 'sawtooth'
        engineOscillator.frequency.value = 50

        // Add a filter for more realistic engine sound
        const engineFilter = audioContext.createBiquadFilter()
        engineFilter.type = 'lowpass'
        engineFilter.frequency.value = 400

        // Connect oscillator -> filter -> gain -> output
        engineOscillator.connect(engineFilter)
        engineFilter.connect(engineGainNode)

        // Start the oscillator
        engineOscillator.start()
        isEngineSoundPlaying = true

        // Start with a low volume
        engineGainNode.gain.setValueAtTime(0.05, audioContext.currentTime)
      }
    }

    // Stop engine sound
    function stopEngineSound () {
      if (isEngineSoundPlaying) {
        // Fade out to avoid clicks
        engineGainNode.gain.setValueAtTime(
          engineGainNode.gain.value,
          audioContext.currentTime
        )
        engineGainNode.gain.linearRampToValueAtTime(
          0,
          audioContext.currentTime + 0.1
        )

        // Stop after fade-out
        setTimeout(() => {
          engineOscillator.stop()
          isEngineSoundPlaying = false
        }, 100)
      }
    }

    // Update engine sound based on speed
    function updateEngineSound (speed) {
      if (!audioContext) return

      if (speed > 0) {
        if (!isEngineSoundPlaying) {
          startEngineSound()
        }

        // Map speed to frequency (engine pitch)
        const baseFreq = 50
        const maxFreq = 120
        const mappedFreq = baseFreq + (maxFreq - baseFreq) * (speed / maxSpeed)

        // Update oscillator frequency
        engineOscillator.frequency.setValueAtTime(
          mappedFreq,
          audioContext.currentTime
        )

        // Adjust volume based on speed
        const volume = 0.05 + (speed / maxSpeed) * 0.15
        engineGainNode.gain.setValueAtTime(volume, audioContext.currentTime)
      } else if (isEngineSoundPlaying && speed === 0) {
        stopEngineSound()
      }
    }

    // Play brake sound
    function playBrakeSound () {
      if (!audioContext) initAudio()

      if (!isBrakeSoundPlaying) {
        isBrakeSoundPlaying = true

        // Create a noise source for brake sound
        const bufferSize = audioContext.sampleRate * 0.5
        const buffer = audioContext.createBuffer(
          1,
          bufferSize,
          audioContext.sampleRate
        )
        const data = buffer.getChannelData(0)

        // Fill buffer with filtered noise
        for (let i = 0; i < bufferSize; i++) {
          // High-frequency noise that decreases over time
          data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize)
        }

        // Create and configure noise source
        const brakeSource = audioContext.createBufferSource()
        brakeSource.buffer = buffer

        // Add a bandpass filter for squeal effect
        const brakeFilter = audioContext.createBiquadFilter()
        brakeFilter.type = 'bandpass'
        brakeFilter.frequency.value = 2000
        brakeFilter.Q.value = 10

        // Connect noise -> filter -> gain -> output
        brakeSource.connect(brakeFilter)
        brakeFilter.connect(brakeGainNode)

        // Set gain and play
        brakeGainNode.gain.setValueAtTime(0, audioContext.currentTime)
        brakeGainNode.gain.linearRampToValueAtTime(
          0.1,
          audioContext.currentTime + 0.1
        )
        brakeSource.start()

        // Schedule stop and cleanup
        brakeSource.onended = () => {
          isBrakeSoundPlaying = false
        }
      }
    }

    // Stop brake sound
    function stopBrakeSound () {
      if (isBrakeSoundPlaying) {
        brakeGainNode.gain.setValueAtTime(
          brakeGainNode.gain.value,
          audioContext.currentTime
        )
        brakeGainNode.gain.linearRampToValueAtTime(
          0,
          audioContext.currentTime + 0.2
        )
      }
    }

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(50, 50, 50)
    camera.lookAt(0, 0, 0)

    // Keyboard state tracking
    const keyState = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false
    }

    // Player car variables
    let playerCar
    let playerSpeed = 0
    const maxSpeed = 0.35
    const acceleration = 0.001
    const deceleration = 0.001
    const brakeStrength = 0.01
    // Add variables for turn rate acceleration/deceleration
    let currentTurnRate = 0
    const maxTurnRate = 0.04
    const turnAcceleration = 0.002
    const turnDeceleration = 0.003
    // Add variables for speed display and odometer
    let speedKmh = 0
    let totalDistanceKm = 0
    const speedConversionFactor = 200 // Changed from 100 to 200 to double the displayed speed
    let lastTime = 0

    // Event listeners for keyboard controls
    const handleKeyDown = e => {
      if (e.key.toLowerCase() === 'w') {
        keyState.w = true
        // Ensure audio context is initialized on first user interaction
        if (!audioContext) initAudio()
      }
      if (e.key.toLowerCase() === 'a') keyState.a = true
      if (e.key.toLowerCase() === 's') keyState.s = true
      if (e.key.toLowerCase() === 'd') keyState.d = true
      if (e.key === ' ') {
        keyState.space = true
        playBrakeSound()
      }
    }

    const handleKeyUp = e => {
      if (e.key.toLowerCase() === 'w') keyState.w = false
      if (e.key.toLowerCase() === 'a') keyState.a = false
      if (e.key.toLowerCase() === 's') keyState.s = false
      if (e.key.toLowerCase() === 'd') keyState.d = false
      if (e.key === ' ') {
        keyState.space = false
        stopBrakeSound()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true

    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement)

    // Controls for camera
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(50, 100, 50)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 500
    directionalLight.shadow.camera.left = -150
    directionalLight.shadow.camera.right = 150
    directionalLight.shadow.camera.top = 150
    directionalLight.shadow.camera.bottom = -150
    directionalLight.shadow.bias = -0.0005
    directionalLight.shadow.normalBias = 0.02
    scene.add(directionalLight)

    // Add supplementary light to reduce harshness of shadows
    const fillLight = new THREE.DirectionalLight(0xffffee, 0.4)
    fillLight.position.set(-30, 80, -50)
    fillLight.castShadow = false
    scene.add(fillLight)

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a5e1a,
      roughness: 0.8
    })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    // City grid
    const gridSize = 15
    const blockSize = 20
    const streetWidth = 10
    const citySize = gridSize * (blockSize + streetWidth)

    // Create buildings
    function createBuilding (x, z, width, depth, height) {
      const buildingGeometry = new THREE.BoxGeometry(width, height, depth)

      // Improved building materials with better light reflection parameters
      const modernColors = [
        // Bright glass-like colors
        0x88ccee, // Sky blue glass
        0x66ddaa, // Teal glass
        0xaaccff, // Light blue glass
        0xddeeff, // Pale blue glass

        // Light contemporary colors
        0xffc09f, // Peach
        0xffee93, // Light yellow
        0xfcf5c7, // Cream
        0xa0ced9, // Powder blue

        // Vibrant colors
        0xff9eaa, // Coral pink
        0xadf7b6, // Mint green
        0xffdfd3, // Light pink
        0x9eebcf, // Seafoam
        0xfdcb6e, // Sunshine yellow
        0xff6b6b, // Bright red
        0xa3d9ff, // Baby blue

        // Pastel tones
        0xffc8dd, // Pastel pink
        0xbde0fe, // Pastel blue
        0xa9def9, // Light sky blue
        0xd0f4de, // Pastel green
        0xe4c1f9, // Lavender
        0xf1f7b5 // Pastel yellow
      ]

      // Improved building material settings for better lighting
      const buildingMaterial = new THREE.MeshStandardMaterial({
        color: modernColors[Math.floor(Math.random() * modernColors.length)],
        roughness: 0.3, // Reduced from 0.5 for more reflectivity
        metalness: 0.2, // Reduced from 0.4 for more natural surfaces
        envMapIntensity: 0.8 // New parameter to enhance reflections
      })

      const building = new THREE.Mesh(buildingGeometry, buildingMaterial)
      building.position.set(x, height / 2, z)
      building.castShadow = true
      building.receiveShadow = true
      scene.add(building)

      // Improved window materials for better reflection
      const windowSize = 1.5
      const windowSpacing = 3
      const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize)
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0x888888, // Brighter emissive value
        emissiveIntensity: 0.2,
        roughness: 0.05, // Reduced from 0.1 for more glossy windows
        metalness: 0.9, // Increased slightly for more reflective windows
        envMapIntensity: 1.2 // Enhance reflections on windows
      })

      // Front windows
      for (
        let wx = -width / 2 + windowSpacing;
        wx < width / 2 - windowSpacing;
        wx += windowSpacing
      ) {
        for (
          let wy = windowSpacing;
          wy < height - windowSpacing;
          wy += windowSpacing
        ) {
          const window = new THREE.Mesh(windowGeometry, windowMaterial)
          window.position.set(x + wx, wy, z + depth / 2 + 0.01)
          scene.add(window)
        }
      }

      // Back windows
      for (
        let wx = -width / 2 + windowSpacing;
        wx < width / 2 - windowSpacing;
        wx += windowSpacing
      ) {
        for (
          let wy = windowSpacing;
          wy < height - windowSpacing;
          wy += windowSpacing
        ) {
          const window = new THREE.Mesh(windowGeometry, windowMaterial)
          window.position.set(x + wx, wy, z - depth / 2 - 0.01)
          window.rotation.y = Math.PI
          scene.add(window)
        }
      }

      // Side windows
      for (
        let wz = -depth / 2 + windowSpacing;
        wz < depth / 2 - windowSpacing;
        wz += windowSpacing
      ) {
        for (
          let wy = windowSpacing;
          wy < height - windowSpacing;
          wy += windowSpacing
        ) {
          const window1 = new THREE.Mesh(windowGeometry, windowMaterial)
          window1.position.set(x + width / 2 + 0.01, wy, z + wz)
          window1.rotation.y = Math.PI / 2
          scene.add(window1)

          const window2 = new THREE.Mesh(windowGeometry, windowMaterial)
          window2.position.set(x - width / 2 - 0.01, wy, z + wz)
          window2.rotation.y = -Math.PI / 2
          scene.add(window2)
        }
      }
    }

    // Create city blocks with buildings
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const blockX =
          i * (blockSize + streetWidth) - citySize / 2 + blockSize / 2
        const blockZ =
          j * (blockSize + streetWidth) - citySize / 2 + blockSize / 2

        // Create 1-2 buildings per block (reduced from 1-3 to have larger buildings)
        const buildingsPerBlock = Math.floor(Math.random() * 2) + 1

        // Increase safety margin to prevent buildings from overflowing onto roads
        const safetyMargin = 4
        const maxBuildingWidth = blockSize - safetyMargin * 2
        const maxBuildingDepth = blockSize - safetyMargin * 2

        if (buildingsPerBlock === 1) {
          // One large building with strict size limits
          const height = 10 + Math.random() * 40

          // Ensure building size is much larger - at least 75% of available space
          // Minimum size is now 75% of max width/depth to ensure thick buildings
          const minSize = maxBuildingWidth * 0.75
          const buildingWidth = Math.max(
            Math.min(blockSize * 0.85, maxBuildingWidth),
            minSize
          )
          const buildingDepth = Math.max(
            Math.min(blockSize * 0.85, maxBuildingDepth),
            minSize
          )

          createBuilding(blockX, blockZ, buildingWidth, buildingDepth, height)
        } else {
          // Two buildings with proper spacing
          // Make subBlockSize larger by using a smaller divisor
          const subBlockSize = Math.min(blockSize / 1.8, maxBuildingWidth * 0.8)

          for (let k = 0; k < buildingsPerBlock; k++) {
            // Calculate maximum allowed offset with reduced distance between buildings
            const maxOffset =
              (blockSize - safetyMargin * 2 - subBlockSize) / 2.5

            // Limit the offset to stay well within boundaries
            const offsetX = (Math.random() - 0.5) * maxOffset * 2
            const offsetZ = (Math.random() - 0.5) * maxOffset * 2

            const height = 5 + Math.random() * 25

            // Much larger minimum building size - at least 75% of allocated space
            const minDimension = subBlockSize * 0.75

            // Narrower range for random sizing to keep buildings more consistent
            const width = Math.max(
              subBlockSize * (0.75 + Math.random() * 0.2),
              minDimension
            )
            const depth = Math.max(
              subBlockSize * (0.75 + Math.random() * 0.2),
              minDimension
            )

            // Verify building won't overflow
            const buildingLeft = blockX + offsetX - width / 2
            const buildingRight = blockX + offsetX + width / 2
            const buildingTop = blockZ + offsetZ - depth / 2
            const buildingBottom = blockZ + offsetZ + depth / 2

            // Calculate block boundaries with safety margin
            const blockLeft = blockX - blockSize / 2 + safetyMargin
            const blockRight = blockX + blockSize / 2 - safetyMargin
            const blockTop = blockZ - blockSize / 2 + safetyMargin
            const blockBottom = blockZ + blockSize / 2 - safetyMargin

            // Only create building if it stays completely within the safe block area
            if (
              buildingLeft >= blockLeft &&
              buildingRight <= blockRight &&
              buildingTop >= blockTop &&
              buildingBottom <= blockBottom
            ) {
              createBuilding(
                blockX + offsetX,
                blockZ + offsetZ,
                width,
                depth,
                height
              )
            }
          }
        }
      }
    }

    // Create roads
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9
    })

    // Road line material - simplified to only white
    const roadLineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      emissive: 0xffffff,
      emissiveIntensity: 0.2
    })

    // Add pavement material
    const pavementMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc, // Light gray for pavement
      roughness: 0.7,
      metalness: 0.1
    })

    // Horizontal roads
    for (let i = 0; i <= gridSize; i++) {
      const roadX =
        i * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2
      const roadGeometry = new THREE.PlaneGeometry(streetWidth, citySize)
      const road = new THREE.Mesh(roadGeometry, roadMaterial)
      road.rotation.x = -Math.PI / 2
      road.position.set(roadX + streetWidth / 2, 0.01, 0)
      road.receiveShadow = true
      scene.add(road)

      // Add pavements on both sides of horizontal roads
      const pavementWidth = streetWidth * 0.1

      // Left pavement
      const leftPavementGeometry = new THREE.PlaneGeometry(
        pavementWidth,
        citySize
      )
      const leftPavement = new THREE.Mesh(
        leftPavementGeometry,
        pavementMaterial
      )
      leftPavement.rotation.x = -Math.PI / 2
      leftPavement.position.set(roadX - pavementWidth / 2, 0.05, 0) // Slightly elevated
      leftPavement.receiveShadow = true
      scene.add(leftPavement)

      // Right pavement
      const rightPavementGeometry = new THREE.PlaneGeometry(
        pavementWidth,
        citySize
      )
      const rightPavement = new THREE.Mesh(
        rightPavementGeometry,
        pavementMaterial
      )
      rightPavement.rotation.x = -Math.PI / 2
      rightPavement.position.set(
        roadX + streetWidth + pavementWidth / 2,
        0.05,
        0
      ) // Slightly elevated
      rightPavement.receiveShadow = true
      scene.add(rightPavement)

      // Add white edge lines
      const leftEdgeGeometry = new THREE.PlaneGeometry(0.2, citySize)
      const leftEdge = new THREE.Mesh(leftEdgeGeometry, roadLineMaterial)
      leftEdge.rotation.x = -Math.PI / 2
      leftEdge.position.set(roadX + 0.5, 0.02, 0)
      scene.add(leftEdge)

      const rightEdgeGeometry = new THREE.PlaneGeometry(0.2, citySize)
      const rightEdge = new THREE.Mesh(rightEdgeGeometry, roadLineMaterial)
      rightEdge.rotation.x = -Math.PI / 2
      rightEdge.position.set(roadX + streetWidth - 0.5, 0.02, 0)
      scene.add(rightEdge)

      // Simplified center dashed line
      for (let dash = 0; dash < citySize; dash += 8) {
        if (dash % 16 < 8) {
          // Creates a dashed pattern
          const dashGeometry = new THREE.PlaneGeometry(0.4, 4)
          const dashLine = new THREE.Mesh(dashGeometry, roadLineMaterial)
          dashLine.rotation.x = -Math.PI / 2
          dashLine.position.set(
            roadX + streetWidth / 2,
            0.02,
            dash - citySize / 2 + 2
          )
          scene.add(dashLine)
        }
      }
    }

    // Vertical roads
    for (let j = 0; j <= gridSize; j++) {
      const roadZ =
        j * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2
      const roadGeometry = new THREE.PlaneGeometry(citySize, streetWidth)
      const road = new THREE.Mesh(roadGeometry, roadMaterial)
      road.rotation.x = -Math.PI / 2
      road.position.set(0, 0.01, roadZ + streetWidth / 2)
      road.receiveShadow = true
      scene.add(road)

      // Add pavements on both sides of vertical roads
      const pavementWidth = streetWidth * 0.1

      // Top pavement
      const topPavementGeometry = new THREE.PlaneGeometry(
        citySize,
        pavementWidth
      )
      const topPavement = new THREE.Mesh(topPavementGeometry, pavementMaterial)
      topPavement.rotation.x = -Math.PI / 2
      topPavement.position.set(0, 0.05, roadZ - pavementWidth / 2) // Slightly elevated
      topPavement.receiveShadow = true
      scene.add(topPavement)

      // Bottom pavement
      const bottomPavementGeometry = new THREE.PlaneGeometry(
        citySize,
        pavementWidth
      )
      const bottomPavement = new THREE.Mesh(
        bottomPavementGeometry,
        pavementMaterial
      )
      bottomPavement.rotation.x = -Math.PI / 2
      bottomPavement.position.set(
        0,
        0.05,
        roadZ + streetWidth + pavementWidth / 2
      ) // Slightly elevated
      bottomPavement.receiveShadow = true
      scene.add(bottomPavement)

      // Add white edge lines
      const topEdgeGeometry = new THREE.PlaneGeometry(citySize, 0.2)
      const topEdge = new THREE.Mesh(topEdgeGeometry, roadLineMaterial)
      topEdge.rotation.x = -Math.PI / 2
      topEdge.position.set(0, 0.02, roadZ + 0.5)
      scene.add(topEdge)

      const bottomEdgeGeometry = new THREE.PlaneGeometry(citySize, 0.2)
      const bottomEdge = new THREE.Mesh(bottomEdgeGeometry, roadLineMaterial)
      bottomEdge.rotation.x = -Math.PI / 2
      bottomEdge.position.set(0, 0.02, roadZ + streetWidth - 0.5)
      scene.add(bottomEdge)

      // Simplified center dashed line
      for (let dash = 0; dash < citySize; dash += 8) {
        if (dash % 16 < 8) {
          // Creates a dashed pattern
          const dashGeometry = new THREE.PlaneGeometry(4, 0.4)
          const dashLine = new THREE.Mesh(dashGeometry, roadLineMaterial)
          dashLine.rotation.x = -Math.PI / 2
          dashLine.position.set(
            dash - citySize / 2 + 2,
            0.02,
            roadZ + streetWidth / 2
          )
          scene.add(dashLine)
        }
      }
    }

    // Create cars
    const cars = []

    function createCar (x, z, direction) {
      const carGroup = new THREE.Group()

      // Car body - reduced dimensions by ~30%
      const bodyGeometry = new THREE.BoxGeometry(0.8, 0.45, 1.6)
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        roughness: 0.5,
        metalness: 0.7
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.23 // Lowered to match new height
      carGroup.add(body)

      // Car top - reduced dimensions
      const topGeometry = new THREE.BoxGeometry(0.7, 0.4, 0.8)
      const topMaterial = new THREE.MeshStandardMaterial({
        color: bodyMaterial.color,
        roughness: 0.5,
        metalness: 0.7
      })
      const top = new THREE.Mesh(topGeometry, topMaterial)
      top.position.set(0, 0.65, -0.2) // Adjusted position
      carGroup.add(top)

      // Wheels - reduced size
      const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16)
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 })

      // Adjusted wheel positions
      const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel1.position.set(0.45, 0.2, 0.5)
      wheel1.rotation.z = Math.PI / 2
      carGroup.add(wheel1)

      const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel2.position.set(-0.45, 0.2, 0.5)
      wheel2.rotation.z = Math.PI / 2
      carGroup.add(wheel2)

      const wheel3 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel3.position.set(0.45, 0.2, -0.5)
      wheel3.rotation.z = Math.PI / 2
      carGroup.add(wheel3)

      const wheel4 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel4.position.set(-0.45, 0.2, -0.5)
      wheel4.rotation.z = Math.PI / 2
      carGroup.add(wheel4)

      // Headlights - scaled down
      const headlightGeometry = new THREE.SphereGeometry(0.08, 16, 16)
      const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 0.5
      })

      const headlight1 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight1.position.set(0.3, 0.2, 0.8)
      carGroup.add(headlight1)

      const headlight2 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight2.position.set(-0.3, 0.2, 0.8)
      carGroup.add(headlight2)

      // Taillights - scaled down
      const taillightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
      })

      const taillight1 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight1.position.set(0.3, 0.2, -0.8)
      carGroup.add(taillight1)

      const taillight2 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight2.position.set(-0.3, 0.2, -0.8)
      carGroup.add(taillight2)

      carGroup.position.set(x, 0, z)

      if (direction === 'horizontal') {
        carGroup.rotation.y = Math.PI / 2
      }

      carGroup.castShadow = true
      carGroup.receiveShadow = true
      scene.add(carGroup)

      return {
        mesh: carGroup,
        direction: direction,
        speed: 0.1 + Math.random() * 0.2,
        lastTurnTime: 0,
        turnProbability: 0.01 + Math.random() * 0.02
      }
    }

    // Create bus - larger vehicle with different appearance
    function createBus(x, z, direction) {
      const busGroup = new THREE.Group()

      // Bus body - larger and taller than cars
      const bodyGeometry = new THREE.BoxGeometry(1.2, 1.1, 3.2) // Increased height from 0.8 to 1.1
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x3366cc, // Blue buses
        roughness: 0.4,
        metalness: 0.6
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.55 // Raised position from 0.4 to 0.55
      busGroup.add(body)

      // Bus top - slightly smaller than body
      const topGeometry = new THREE.BoxGeometry(1.1, 0.2, 3.0)
      const topMaterial = new THREE.MeshStandardMaterial({
        color: 0x3366cc,
        roughness: 0.4,
        metalness: 0.6
      })
      const top = new THREE.Mesh(topGeometry, topMaterial)
      top.position.set(0, 1.2, 0) // Raised from 0.9 to 1.2
      busGroup.add(top)

      // Windows - adding windows on both sides - positioned higher
      const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.7
      })

      // Add multiple windows on each side
      for (let i = -1.2; i <= 1.2; i += 0.6) {
        // Right side windows
        const rightWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 0.4),
          windowMaterial
        )
        rightWindow.position.set(0.61, 0.9, i) // Raised from 0.7 to 0.9
        rightWindow.rotation.y = Math.PI / 2
        busGroup.add(rightWindow)

        // Left side windows
        const leftWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 0.4),
          windowMaterial
        )
        leftWindow.position.set(-0.61, 0.9, i) // Raised from 0.7 to 0.9
        leftWindow.rotation.y = -Math.PI / 2
        busGroup.add(leftWindow)
      }

      // Windshield
      const windshield = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.5),
        windowMaterial
      )
      windshield.position.set(0, 0.9, 1.61) // Raised from 0.7 to 0.9
      busGroup.add(windshield)

      // Wheels - larger than car wheels
      const wheelGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16)
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 })

      const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel1.position.set(0.65, 0.25, 1.2)
      wheel1.rotation.z = Math.PI / 2
      busGroup.add(wheel1)

      const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel2.position.set(-0.65, 0.25, 1.2)
      wheel2.rotation.z = Math.PI / 2
      busGroup.add(wheel2)

      const wheel3 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel3.position.set(0.65, 0.25, 0)
      wheel3.rotation.z = Math.PI / 2
      busGroup.add(wheel3)

      const wheel4 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel4.position.set(-0.65, 0.25, 0)
      wheel4.rotation.z = Math.PI / 2
      busGroup.add(wheel4)

      const wheel5 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel5.position.set(0.65, 0.25, -1.2)
      wheel5.rotation.z = Math.PI / 2
      busGroup.add(wheel5)

      const wheel6 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel6.position.set(-0.65, 0.25, -1.2)
      wheel6.rotation.z = Math.PI / 2
      busGroup.add(wheel6)

      // Headlights
      const headlightGeometry = new THREE.SphereGeometry(0.1, 16, 16)
      const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 0.5
      })

      const headlight1 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight1.position.set(0.5, 0.4, 1.61)
      busGroup.add(headlight1)

      const headlight2 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight2.position.set(-0.5, 0.4, 1.61)
      busGroup.add(headlight2)

      // Taillights
      const taillightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
      })

      const taillight1 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight1.position.set(0.5, 0.4, -1.61)
      busGroup.add(taillight1)

      const taillight2 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight2.position.set(-0.5, 0.4, -1.61)
      busGroup.add(taillight2)

      busGroup.position.set(x, 0, z)

      if (direction === 'horizontal') {
        busGroup.rotation.y = Math.PI / 2
      }

      busGroup.castShadow = true
      busGroup.receiveShadow = true
      scene.add(busGroup)

      return {
        mesh: busGroup,
        direction: direction,
        speed: 0.06 + Math.random() * 0.04, // Buses move slower than most cars
        lastTurnTime: 0,
        turnProbability: 0.005 + Math.random() * 0.01, // Buses turn less frequently
        isBus: true // Flag to identify as a bus
      }
    }

    // Add cars to roads
    for (let i = 0; i < 130; i++) {
      let x, z, direction, movingDirection

      if (Math.random() > 0.5) {
        // Horizontal road
        direction = 'horizontal'
        movingDirection = Math.random() > 0.5 ? 1 : -1 // Random direction (positive or negative)
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        z =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        x = (Math.random() - 0.5) * citySize
      } else {
        // Vertical road
        direction = 'vertical'
        movingDirection = Math.random() > 0.5 ? 1 : -1 // Random direction (positive or negative)
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        x =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        z = (Math.random() - 0.5) * citySize
      }

      const car = createCar(x, z, direction)

      // Create diverse speed distribution:
      // 10% very slow, 65% normal speeds, 25% faster cars
      const speedMultiplier = Math.random()
      if (speedMultiplier < 0.1) {
        // Slow cars (0.03 to 0.05)
        car.speed = 0.03 + Math.random() * 0.02
      } else if (speedMultiplier > 0.75) {
        // Fast cars (0.09 to 0.12)
        car.speed = 0.09 + Math.random() * 0.03
      } else {
        // Normal cars (0.06 to 0.15)
        car.speed = 0.06 + Math.random() * 0.09
      }

      car.speed *= movingDirection // Apply direction to speed
      car.lastTurnTime = 0 // Track when the car last turned
      car.turnProbability = 0.01 + Math.random() * 0.02 // Different turn probabilities for each car

      // Rotate car if moving in negative direction
      if (movingDirection < 0) {
        if (direction === 'horizontal') {
          car.mesh.rotation.y += Math.PI
        } else {
          car.mesh.rotation.y += Math.PI
        }
      }

      cars.push(car)
    }

    // Add buses to roads - Add this code after the existing car creation loop
    const buses = []
    for (let i = 0; i < 25; i++) { // Add 25 buses to the city
      let x, z, direction, movingDirection

      if (Math.random() > 0.5) {
        // Horizontal road
        direction = 'horizontal'
        movingDirection = Math.random() > 0.5 ? 1 : -1 // Random direction
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        z = roadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2
        x = (Math.random() - 0.5) * citySize
      } else {
        // Vertical road
        direction = 'vertical'
        movingDirection = Math.random() > 0.5 ? 1 : -1 // Random direction
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        x = roadIndex * (blockSize + streetWidth) - citySize / 2 - streetWidth / 2 + streetWidth / 2
        z = (Math.random() - 0.5) * citySize
      }

      const bus = createBus(x, z, direction)

      // Set bus speed (slower than cars)
      bus.speed *= movingDirection

      // Rotate bus if moving in negative direction
      if (movingDirection < 0) {
        if (direction === 'horizontal') {
          bus.mesh.rotation.y += Math.PI
        } else {
          bus.mesh.rotation.y += Math.PI
        }
      }

      // Add to array of vehicles
      cars.push(bus) // Add buses to the cars array to use the same movement logic
    }

    // Create people
    const people = []

    function createPerson (x, z) {
      const personGroup = new THREE.Group()

      // Body - reduced by ~30%
      const bodyGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 8)
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() * 0xffffff,
        roughness: 0.8
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.35
      personGroup.add(body)

      // Head - reduced size
      const headGeometry = new THREE.SphereGeometry(0.18, 16, 16)
      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xffdbac,
        roughness: 0.8
      })
      const head = new THREE.Mesh(headGeometry, headMaterial)
      head.position.y = 0.9
      personGroup.add(head)

      // Legs - reduced size
      const legGeometry = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8)
      const legMaterial = new THREE.MeshStandardMaterial({
        color: 0x0000ff,
        roughness: 0.8
      })

      const leg1 = new THREE.Mesh(legGeometry, legMaterial)
      leg1.position.set(0.12, -0.25, 0)
      personGroup.add(leg1)

      const leg2 = new THREE.Mesh(legGeometry, legMaterial)
      leg2.position.set(-0.12, -0.25, 0)
      personGroup.add(leg2)

      personGroup.position.set(x, 0, z)
      personGroup.castShadow = true
      personGroup.receiveShadow = true
      scene.add(personGroup)

      return {
        mesh: personGroup,
        direction: Math.random() * Math.PI * 2,
        speed: 0.03 + Math.random() * 0.02,
        walkCycle: Math.random() * Math.PI * 2,
        sidewalkOrientation: null
      }
    }

    // Add people to sidewalks
    for (let i = 0; i < 200; i++) {
      let x, z
      let sidewalkOrientation // Track if person is on horizontal or vertical sidewalk

      // Position people along sidewalks
      if (Math.random() > 0.5) {
        // Horizontal sidewalk
        sidewalkOrientation = 'horizontal'
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        z =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        // Position strictly on the pavement area
        z += Math.random() > 0.5 ? streetWidth * 0.4 : -streetWidth * 0.4
        x = (Math.random() - 0.5) * citySize
        // Set initial direction along the sidewalk
        const direction = Math.random() > 0.5 ? 0 : Math.PI
      } else {
        // Vertical sidewalk
        sidewalkOrientation = 'vertical'
        const roadIndex = Math.floor(Math.random() * (gridSize + 1))
        x =
          roadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2
        // Position strictly on the pavement area
        x += Math.random() > 0.5 ? streetWidth * 0.4 : -streetWidth * 0.4
        z = (Math.random() - 0.5) * citySize
        // Set initial direction along the sidewalk
        const direction = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2
      }

      const person = createPerson(x, z)

      // Create diverse walking speeds:
      // 15% very slow, 60% normal speeds, 25% fast walkers
      const speedType = Math.random()
      if (speedType < 0.15) {
        // Slow walkers (0.005 to 0.015)
        person.speed = 0.005 + Math.random() * 0.01
      } else if (speedType > 0.75) {
        // Fast walkers (0.06 to 0.09)
        person.speed = 0.06 + Math.random() * 0.03
      } else {
        // Normal walkers (0.02 to 0.04)
        person.speed = 0.02 + Math.random() * 0.02
      }

      // Set direction based on orientation
      if (sidewalkOrientation === 'horizontal') {
        person.direction = Math.random() > 0.5 ? 0 : Math.PI // East or West
      } else {
        person.direction = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2 // North or South
      }
      person.sidewalkOrientation = sidewalkOrientation
      people.push(person)
    }

    // Create player car - also reduced in size but kept slightly larger than AI cars
    function createPlayerCar () {
      const carGroup = new THREE.Group()

      // Car body - reduced but still slightly larger than regular cars
      const bodyGeometry = new THREE.BoxGeometry(1.0, 0.55, 2.0)
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000, // Red car for player
        roughness: 0.3,
        metalness: 0.8
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.y = 0.28
      carGroup.add(body)

      // Car top
      const topGeometry = new THREE.BoxGeometry(0.9, 0.4, 0.9)
      const topMaterial = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        roughness: 0.3,
        metalness: 0.8
      })
      const top = new THREE.Mesh(topGeometry, topMaterial)
      top.position.set(0, 0.75, -0.2)
      carGroup.add(top)

      // Wheels
      const wheelGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16)
      const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 })

      const wheel1 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel1.position.set(0.55, 0.22, 0.65)
      wheel1.rotation.z = Math.PI / 2
      carGroup.add(wheel1)

      const wheel2 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel2.position.set(-0.55, 0.22, 0.65)
      wheel2.rotation.z = Math.PI / 2
      carGroup.add(wheel2)

      const wheel3 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel3.position.set(0.55, 0.22, -0.65)
      wheel3.rotation.z = Math.PI / 2
      carGroup.add(wheel3)

      const wheel4 = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel4.position.set(-0.55, 0.22, -0.65)
      wheel4.rotation.z = Math.PI / 2
      carGroup.add(wheel4)

      // Headlights
      const headlightGeometry = new THREE.SphereGeometry(0.11, 16, 16)
      const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffcc,
        emissive: 0xffffcc,
        emissiveIntensity: 1
      })

      const headlight1 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight1.position.set(0.4, 0.22, 1.0)
      carGroup.add(headlight1)

      const headlight2 = new THREE.Mesh(headlightGeometry, headlightMaterial)
      headlight2.position.set(-0.4, 0.22, 1.0)
      carGroup.add(headlight2)

      // Taillights
      const taillightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1
      })

      const taillight1 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight1.position.set(0.4, 0.22, -1.0)
      carGroup.add(taillight1)

      const taillight2 = new THREE.Mesh(headlightGeometry, taillightMaterial)
      taillight2.position.set(-0.4, 0.22, -1.0)
      carGroup.add(taillight2)

      // Place the car on a road
      const randomRoadIndex = Math.floor(Math.random() * (gridSize + 1))
      carGroup.position.set(
        randomRoadIndex * (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2,
        0,
        0
      )

      carGroup.castShadow = true
      carGroup.receiveShadow = true
      scene.add(carGroup)

      return carGroup
    }

    // Initialize player car
    playerCar = createPlayerCar()

    // Initial camera position behind the car
    const initialCameraPosition = new THREE.Vector3(
      playerCar.position.x - Math.sin(playerCar.rotation.y) * 12,
      playerCar.position.y + 5,
      playerCar.position.z - Math.cos(playerCar.rotation.y) * 12
    )
    camera.position.copy(initialCameraPosition)
    camera.lookAt(playerCar.position)

    // Disable orbit controls completely
    controls.enabled = false

    // Add display elements for speed and distance
    const speedometerDiv = document.createElement('div')
    speedometerDiv.style.position = 'absolute'
    speedometerDiv.style.bottom = '20px'
    speedometerDiv.style.right = '20px'
    speedometerDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
    speedometerDiv.style.color = 'white'
    speedometerDiv.style.padding = '10px'
    speedometerDiv.style.borderRadius = '5px'
    speedometerDiv.style.fontFamily = 'Arial, sans-serif'
    speedometerDiv.style.fontSize = '16px'
    speedometerDiv.style.zIndex = '1000'
    speedometerDiv.innerHTML = 'Speed: 0 km/h<br>Distance: 0.0 km'
    document.body.appendChild(speedometerDiv)

    // Animation loop
    function animate () {
      const currentTime = performance.now()
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      window.requestAnimationFrame(animate)

      // Handle player car controls
      if (keyState.w) {
        // Accelerate forward
        playerSpeed = Math.min(playerSpeed + acceleration, maxSpeed)
      } else if (keyState.s) {
        // Accelerate backward
        playerSpeed = Math.max(playerSpeed - acceleration, -maxSpeed / 1.5)
      } else {
        // Natural deceleration when not pressing forward/backward
        if (playerSpeed > 0) {
          playerSpeed = Math.max(playerSpeed - deceleration, 0)
        } else if (playerSpeed < 0) {
          playerSpeed = Math.min(playerSpeed + deceleration, 0)
        }
      }

      // Apply brakes
      if (keyState.space) {
        if (playerSpeed > 0) {
          playerSpeed = Math.max(playerSpeed - brakeStrength, 0)
        } else if (playerSpeed < 0) {
          playerSpeed = Math.min(playerSpeed + brakeStrength, 0)
        }
      }

      // Update engine sound based on speed
      updateEngineSound(Math.abs(playerSpeed))

      // Calculate speed in km/h and distance
      speedKmh = Math.abs(playerSpeed * speedConversionFactor)

      // Calculate distance traveled in this frame (in km)
      // Only add distance when moving
      if (playerSpeed !== 0) {
        const distanceThisFrame =
          Math.abs(playerSpeed) *
          (deltaTime / 1000) *
          (speedConversionFactor / 3600)
        totalDistanceKm += distanceThisFrame
      }

      // Update speedometer display
      speedometerDiv.innerHTML = `Speed: ${Math.round(
        speedKmh
      )} km/h<br>Distance: ${totalDistanceKm.toFixed(2)} km`

      // Smooth turning implementation
      // Higher speeds = slower turning (more realistic)
      const speedFactor =
        1 - Math.min((Math.abs(playerSpeed) / maxSpeed) * 0.6, 0.6)
      const effectiveMaxTurnRate = maxTurnRate * speedFactor

      if (keyState.a) {
        // Gradually increase left turn rate
        currentTurnRate = Math.min(
          currentTurnRate + turnAcceleration,
          effectiveMaxTurnRate
        )
      } else if (keyState.d) {
        // Gradually increase right turn rate
        currentTurnRate = Math.max(
          currentTurnRate - turnAcceleration,
          -effectiveMaxTurnRate
        )
      } else {
        // Gradually return to straight driving
        if (currentTurnRate > 0) {
          currentTurnRate = Math.max(currentTurnRate - turnDeceleration, 0)
        } else if (currentTurnRate < 0) {
          currentTurnRate = Math.min(currentTurnRate + turnDeceleration, 0)
        }
      }

      // Apply turn rate only when moving
      if (playerSpeed !== 0) {
        playerCar.rotation.y += currentTurnRate
      }

      // Move player car
      if (playerSpeed !== 0) {
        playerCar.position.x += Math.sin(playerCar.rotation.y) * playerSpeed
        playerCar.position.z += Math.cos(playerCar.rotation.y) * playerSpeed
      }

      // Keep player within bounds - updated for larger ground
      const groundHalfSize = 250 // Half of 500 (new ground plane size)
      playerCar.position.x = Math.max(
        Math.min(playerCar.position.x, groundHalfSize),
        -groundHalfSize
      )
      playerCar.position.z = Math.max(
        Math.min(playerCar.position.z, groundHalfSize),
        -groundHalfSize
      )

      // Update camera to follow car - improved version
      // Set camera directly behind car at fixed distance - more reliable approach
      const cameraDistance = 8 // Reduced from 15 for closer view
      const cameraHeight = 4 // Reduced from 6 for closer view

      // Calculate position directly rather than using lerp
      camera.position.set(
        playerCar.position.x - Math.sin(playerCar.rotation.y) * cameraDistance,
        playerCar.position.y + cameraHeight,
        playerCar.position.z - Math.cos(playerCar.rotation.y) * cameraDistance
      )

      // Look at a point slightly above the car
      const carLookPoint = new THREE.Vector3(
        playerCar.position.x,
        playerCar.position.y + 1,
        playerCar.position.z
      )
      camera.lookAt(carLookPoint)

      // Update car positions
      cars.forEach(car => {
        // Increment turn timer
        car.lastTurnTime++

        if (car.direction === 'horizontal') {
          car.mesh.position.x += car.speed

          // Check if car should turn at an intersection inside the city
          const isNearIntersection = Math.abs(
            Math.round(
              ((car.mesh.position.x + citySize / 2) /
                (blockSize + streetWidth)) *
                (blockSize + streetWidth) -
                (car.mesh.position.x + citySize / 2)
            ) < 1
          )

          if (
            isNearIntersection &&
            car.lastTurnTime > 100 &&
            Math.random() < car.turnProbability
          ) {
            // Find the nearest road intersection
            const nearestRoadIndex = Math.round(
              (car.mesh.position.x + citySize / 2) / (blockSize + streetWidth)
            )
            const nearestRoadZ =
              nearestRoadIndex * (blockSize + streetWidth) -
              citySize / 2 -
              streetWidth / 2 +
              streetWidth / 2

            // Make sure we're not at the edge of the grid
            if (nearestRoadIndex >= 0 && nearestRoadIndex <= gridSize) {
              // Randomly choose to turn left or right
              const turnDirection = Math.random() > 0.5 ? 1 : -1

              // Snap to the intersection
              car.mesh.position.x =
                Math.round(
                  (car.mesh.position.x + citySize / 2) /
                    (blockSize + streetWidth)
                ) *
                  (blockSize + streetWidth) -
                citySize / 2

              // Adjust to the nearest road
              car.mesh.position.z = nearestRoadZ

              // Update direction and rotation
              car.direction = 'vertical'
              car.speed = Math.abs(car.speed) * turnDirection

              // Set proper rotation based on new direction
              if (turnDirection > 0) {
                // Turn south
                car.mesh.rotation.y = car.speed > 0 ? 0 : Math.PI
              } else {
                // Turn north
                car.mesh.rotation.y = car.speed > 0 ? Math.PI : 0
              }

              // Reset turn timer
              car.lastTurnTime = 0
            }
          }

          // Modified logic for cars reaching edge of city - always force a turn
          if (
            (car.speed > 0 && car.mesh.position.x > citySize / 2 - 2) ||
            (car.speed < 0 && car.mesh.position.x < -citySize / 2 + 2)
          ) {
            // Find the nearest road intersection
            const nearestRoadIndex = Math.round(
              (car.mesh.position.z + citySize / 2) / (blockSize + streetWidth)
            )
            const nearestRoadZ =
              nearestRoadIndex * (blockSize + streetWidth) -
              citySize / 2 -
              streetWidth / 2 +
              streetWidth / 2

            // Position the car at the edge (but still visible)
            if (car.speed > 0) {
              car.mesh.position.x = citySize / 2 - 2
            } else {
              car.mesh.position.x = -citySize / 2 + 2
            }

            // Ensure we're on a valid road
            car.mesh.position.z = nearestRoadZ

            // Update direction and rotation - always turn (no random)
            car.direction = 'vertical'
            // Randomly choose turn direction
            const turnDirection = Math.random() > 0.5 ? 1 : -1
            car.speed = Math.abs(car.speed) * turnDirection

            // Set proper rotation based on new direction
            if (turnDirection > 0) {
              // Turn south
              car.mesh.rotation.y = car.speed > 0 ? 0 : Math.PI
            } else {
              // Turn north
              car.mesh.rotation.y = car.speed > 0 ? Math.PI : 0
            }

            // Reset turn timer
            car.lastTurnTime = 0
          }
        } else {
          car.mesh.position.z += car.speed

          // Check if car should turn at an intersection inside the city
          const isNearIntersection =
            Math.abs(
              Math.round(
                (car.mesh.position.z + citySize / 2) / (blockSize + streetWidth)
              ) *
                (blockSize + streetWidth) -
                (car.mesh.position.z + citySize / 2)
            ) < 1

          if (
            isNearIntersection &&
            car.lastTurnTime > 100 &&
            Math.random() < car.turnProbability
          ) {
            // Find the nearest road intersection
            const nearestRoadIndex = Math.round(
              (car.mesh.position.x + citySize / 2) / (blockSize + streetWidth)
            )
            const nearestRoadX =
              nearestRoadIndex * (blockSize + streetWidth) -
              citySize / 2 -
              streetWidth / 2 +
              streetWidth / 2

            // Make sure we're not at the edge of the grid
            if (nearestRoadIndex >= 0 && nearestRoadIndex <= gridSize) {
              // Randomly choose to turn left or right
              const turnDirection = Math.random() > 0.5 ? 1 : -1

              // Snap to the intersection
              car.mesh.position.z =
                Math.round(
                  (car.mesh.position.z + citySize / 2) /
                    (blockSize + streetWidth)
                ) *
                  (blockSize + streetWidth) -
                citySize / 2

              // Adjust to the nearest road
              car.mesh.position.x = nearestRoadX

              // Update direction and rotation
              car.direction = 'horizontal'
              car.speed = Math.abs(car.speed) * turnDirection

              // Set proper rotation based on new direction
              if (turnDirection > 0) {
                // Turn east
                car.mesh.rotation.y = car.speed > 0 ? Math.PI / 2 : -Math.PI / 2
              } else {
                // Turn west
                car.mesh.rotation.y = car.speed > 0 ? -Math.PI / 2 : Math.PI / 2
              }

              // Reset turn timer
              car.lastTurnTime = 0
            }
          }

          // Modified logic for cars reaching edge of city - always force a turn
          if (
            (car.speed > 0 && car.mesh.position.z > citySize / 2 - 2) ||
            (car.speed < 0 && car.mesh.position.z < -citySize / 2 + 2)
          ) {
            // Find the nearest road intersection
            const nearestRoadIndex = Math.round(
              (car.mesh.position.x + citySize / 2) / (blockSize + streetWidth)
            )
            const nearestRoadX =
              nearestRoadIndex * (blockSize + streetWidth) -
              citySize / 2 -
              streetWidth / 2 +
              streetWidth / 2

            // Position the car at the edge (but still visible)
            if (car.speed > 0) {
              car.mesh.position.z = citySize / 2 - 2
            } else {
              car.mesh.position.z = -citySize / 2 + 2
            }

            // Ensure we're on a valid road
            car.mesh.position.x = nearestRoadX

            // Update direction and rotation - always turn (no random)
            car.direction = 'horizontal'
            // Randomly choose left or right turn
            const turnDirection = Math.random() > 0.5 ? 1 : -1
            car.speed = Math.abs(car.speed) * turnDirection

            // Set proper rotation based on new direction
            if (turnDirection > 0) {
              // Turn east
              car.mesh.rotation.y = car.speed > 0 ? Math.PI / 2 : -Math.PI / 2
            } else {
              // Turn west
              car.mesh.rotation.y = car.speed > 0 ? -Math.PI / 2 : Math.PI / 2
            }

            // Reset turn timer
            car.lastTurnTime = 0
          }
        }
      })

      // Update people positions
      people.forEach(person => {
        person.walkCycle += 0.1

        // Simple walking animation
        const leg1 = person.mesh.children[2]
        const leg2 = person.mesh.children[3]
        leg1.rotation.x = Math.sin(person.walkCycle) * 0.5
        leg2.rotation.x = Math.sin(person.walkCycle + Math.PI) * 0.5

        // Store previous position to check if we need to find a new sidewalk
        const prevX = person.mesh.position.x
        const prevZ = person.mesh.position.z

        // Move person along sidewalk
        if (person.sidewalkOrientation === 'horizontal') {
          // Only move in x direction on horizontal sidewalks
          person.mesh.position.x += Math.cos(person.direction) * person.speed
        } else {
          // Only move in z direction on vertical sidewalks
          person.mesh.position.z += Math.sin(person.direction) * person.speed
        }

        // Check if person has reached an intersection
        const nearestHorizontalRoad =
          Math.round(
            (person.mesh.position.z + citySize / 2) / (blockSize + streetWidth)
          ) *
            (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2

        const nearestVerticalRoad =
          Math.round(
            (person.mesh.position.x + citySize / 2) / (blockSize + streetWidth)
          ) *
            (blockSize + streetWidth) -
          citySize / 2 -
          streetWidth / 2 +
          streetWidth / 2

        const atIntersection =
          Math.abs(person.mesh.position.z - nearestHorizontalRoad) < 1 &&
          Math.abs(person.mesh.position.x - nearestVerticalRoad) < 1

        // At city edges, reverse direction
        if (person.sidewalkOrientation === 'horizontal') {
          if (person.mesh.position.x > citySize / 2 - 1) {
            person.direction = Math.PI // West
            person.mesh.position.x = citySize / 2 - 1
          } else if (person.mesh.position.x < -citySize / 2 + 1) {
            person.direction = 0 // East
            person.mesh.position.x = -citySize / 2 + 1
          }
        } else {
          // vertical sidewalk
          if (person.mesh.position.z > citySize / 2 - 1) {
            person.direction = -Math.PI / 2 // North
            person.mesh.position.z = citySize / 2 - 1
          } else if (person.mesh.position.z < -citySize / 2 + 1) {
            person.direction = Math.PI / 2 // South
            person.mesh.position.z = -citySize / 2 + 1
          }
        }

        // At intersections, sometimes change direction
        if (atIntersection && Math.random() < 0.02) {
          // Determine which sidewalk to move to
          if (person.sidewalkOrientation === 'horizontal') {
            // Switch to vertical sidewalk
            person.sidewalkOrientation = 'vertical'
            // Ensure we're aligned with the vertical sidewalk
            person.mesh.position.x =
              nearestVerticalRoad +
              (Math.random() > 0.5 ? streetWidth * 0.4 : -streetWidth * 0.4)
            // Choose North or South
            person.direction = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2
          } else {
            // Switch to horizontal sidewalk
            person.sidewalkOrientation = 'horizontal'
            // Ensure we're aligned with the horizontal sidewalk
            person.mesh.position.z =
              nearestHorizontalRoad +
              (Math.random() > 0.5 ? streetWidth * 0.4 : -streetWidth * 0.4)
            // Choose East or West
            person.direction = Math.random() > 0.5 ? 0 : Math.PI
          }
        }

        // Update rotation to match direction
        person.mesh.rotation.y = person.direction
      })

      // Don't call controls.update() since we disabled orbit controls
      renderer.render(scene, camera)
    }

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    animate()

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      mountRef.current.removeChild(renderer.domElement)
      document.body.removeChild(speedometerDiv)

      // Clean up audio
      if (audioContext) {
        if (isEngineSoundPlaying) {
          engineOscillator.stop()
        }
        audioContext.close()
      }
    }
  }, []) // Empty dependency array ensures this runs once on mount

  return (
    <div className='h-screen w-full'>
      <div ref={mountRef} className='w-full h-full' />
    </div>
  )
}
