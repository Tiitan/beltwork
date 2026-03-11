export const stationImageSize = {
  width: 1536,
  height: 1024,
}

export type StationSlotLayout = {
  slotIndex: number
  x: number
  y: number
  width: number
  height: number
}

export const stationSlotLayout: StationSlotLayout[] = [
  { slotIndex: 1, x: 520, y: 280, width: 220, height: 160 },
  { slotIndex: 2, x: 775, y: 240, width: 220, height: 160 },
  { slotIndex: 3, x: 1010, y: 280, width: 220, height: 160 },
  { slotIndex: 4, x: 340, y: 420, width: 220, height: 160 },
  { slotIndex: 5, x: 635, y: 415, width: 220, height: 160 },
  { slotIndex: 6, x: 915, y: 415, width: 220, height: 160 },
  { slotIndex: 7, x: 1200, y: 425, width: 220, height: 160 },
  { slotIndex: 8, x: 500, y: 600, width: 220, height: 160 },
  { slotIndex: 9, x: 780, y: 600, width: 220, height: 160 },
  { slotIndex: 10, x: 1065, y: 600, width: 220, height: 160 },
]
