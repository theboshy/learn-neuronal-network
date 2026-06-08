const DELTA_TIME = 60
const INFINITY = 10000000

const VEHICLE_MODELS = {
    car: {
        id: 'car',
        label: 'Auto',
        icon: '🚗',
        width: 30,
        height: 50,
        maxSpeed: 3,
        storageKey: 'best-brain-car'
    },
    moto: {
        id: 'moto',
        label: 'Moto',
        icon: '🏍️',
        width: 16,
        height: 38,
        maxSpeed: 3.6,
        storageKey: 'best-brain-moto'
    },
    bus: {
        id: 'bus',
        label: 'Bus',
        icon: '🚌',
        width: 38,
        height: 95,
        maxSpeed: 2.4,
        storageKey: 'best-brain-bus'
    }
}

const SELECTED_MODEL_KEY = 'selected-model'
