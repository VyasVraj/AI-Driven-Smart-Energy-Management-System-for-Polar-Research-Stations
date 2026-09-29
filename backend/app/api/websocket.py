from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, station_id: int):
        await websocket.accept()
        if station_id not in self.active_connections:
            self.active_connections[station_id] = []
        self.active_connections[station_id].append(websocket)

    def disconnect(self, websocket: WebSocket, station_id: int):
        if station_id in self.active_connections:
            self.active_connections[station_id].remove(websocket)

    async def broadcast_to_station(self, station_id: int, message: dict):
        if station_id in self.active_connections:
            for connection in self.active_connections[station_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/energy/{station_id}")
async def websocket_endpoint(websocket: WebSocket, station_id: int):
    await manager.connect(websocket, station_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, station_id)
