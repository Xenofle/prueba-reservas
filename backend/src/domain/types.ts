export type Room = {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  bufferMinutes: number;
};

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export type Booking = {
  id: string;
  roomId: string;
  title: string;
  client: string;
  start: string;
  end: string;
  status: BookingStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};
