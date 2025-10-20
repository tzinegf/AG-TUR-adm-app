import { supabase } from '../lib/supabase';

export interface Seat {
  id: string;
  route_id: string;
  seat_number: string;
  seat_type: 'standard' | 'window' | 'aisle' | 'premium';
  row_number: number;
  position: 'A' | 'B' | 'C' | 'D';
  is_available: boolean;
  price_modifier: number;
  created_at: string;
  updated_at: string;
}

export interface BookingSeat {
  id: string;
  booking_id: string;
  seat_id: string;
  passenger_name?: string;
  passenger_document?: string;
  created_at: string;
}

export const seatsService = {
  // Buscar poltronas disponíveis para uma rota
  async getAvailableSeats(routeId: string): Promise<Seat[]> {
    try {
      const { data, error } = await supabase
        .from('seats')
        .select('*')
        .eq('route_id', routeId)
        .eq('is_available', true)
        .order('row_number')
        .order('position');

      if (error) throw error;
      return data as Seat[];
    } catch (error) {
      console.error('Error fetching available seats:', error);
      throw error;
    }
  },

  // Buscar todas as poltronas de uma rota (disponíveis e ocupadas)
  async getAllSeatsForRoute(routeId: string): Promise<Seat[]> {
    try {
      console.log('Getting all seats for route:', routeId);
      
      // First, try to get existing seats
      const { data: existingSeats, error: fetchError } = await supabase
        .from('seats')
        .select('*')
        .eq('route_id', routeId)
        .order('row_number', { ascending: true })
        .order('position', { ascending: true });

      if (fetchError) {
        console.error('Error fetching seats:', fetchError);
        throw fetchError;
      }

      console.log('Existing seats found:', existingSeats?.length || 0);

      // If no seats exist, create them automatically
      if (!existingSeats || existingSeats.length === 0) {
        console.log('No seats found, creating seats for route:', routeId);
        await this.createSeatsForRoute(routeId);
        
        // Fetch the newly created seats
        const { data: newSeats, error: newFetchError } = await supabase
          .from('seats')
          .select('*')
          .eq('route_id', routeId)
          .order('row_number', { ascending: true })
          .order('position', { ascending: true });

        if (newFetchError) {
          console.error('Error fetching new seats:', newFetchError);
          throw newFetchError;
        }

        console.log('New seats created:', newSeats?.length || 0);
        return newSeats || [];
      }

      return existingSeats;
    } catch (error) {
      console.error('Error in getAllSeatsForRoute:', error);
      throw error;
    }
  },

  // Verificar se poltronas específicas estão disponíveis
  async checkSeatsAvailability(seatIds: string[]): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('seats')
        .select('id, is_available')
        .in('id', seatIds);

      if (error) throw error;
      
      // Verificar se todas as poltronas estão disponíveis
      return data?.every(seat => seat.is_available) || false;
    } catch (error) {
      console.error('Error checking seats availability:', error);
      return false;
    }
  },

  // Reservar poltronas para uma reserva
  async reserveSeats(bookingId: string, seatIds: string[], passengerInfo?: { name?: string; document?: string }[]): Promise<BookingSeat[]> {
    try {
      // Primeiro, verificar se as poltronas ainda estão disponíveis
      const isAvailable = await this.checkSeatsAvailability(seatIds);
      if (!isAvailable) {
        throw new Error('Uma ou mais poltronas não estão mais disponíveis');
      }

      // Criar registros na tabela booking_seats
      const bookingSeats = seatIds.map((seatId, index) => ({
        booking_id: bookingId,
        seat_id: seatId,
        passenger_name: passengerInfo?.[index]?.name,
        passenger_document: passengerInfo?.[index]?.document,
      }));

      const { data, error } = await supabase
        .from('booking_seats')
        .insert(bookingSeats)
        .select();

      if (error) throw error;
      return data as BookingSeat[];
    } catch (error) {
      console.error('Error reserving seats:', error);
      throw error;
    }
  },

  // Liberar poltronas de uma reserva cancelada
  async releaseSeats(bookingId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('booking_seats')
        .delete()
        .eq('booking_id', bookingId);

      if (error) throw error;
    } catch (error) {
      console.error('Error releasing seats:', error);
      throw error;
    }
  },

  // Buscar poltronas de uma reserva específica
  async getBookingSeats(bookingId: string): Promise<(BookingSeat & { seat: Seat })[]> {
    try {
      const { data, error } = await supabase
        .from('booking_seats')
        .select(`
          *,
          seat:seats(*)
        `)
        .eq('booking_id', bookingId);

      if (error) throw error;
      return data as (BookingSeat & { seat: Seat })[];
    } catch (error) {
      console.error('Error fetching booking seats:', error);
      throw error;
    }
  },

  // Criar poltronas para uma nova rota (função administrativa)
  async createSeatsForRoute(routeId: string, totalSeats: number = 40): Promise<void> {
    try {
      console.log('Creating seats for route:', routeId);
      
      const seats: Omit<Seat, 'id' | 'created_at' | 'updated_at'>[] = [];
      
      // Create a standard bus layout (12 rows, 4 seats per row with aisle)
      for (let row = 1; row <= 12; row++) {
        // Left side seats (positions A and B)
        seats.push({
          route_id: routeId,
          seat_number: `${row}A`,
          seat_type: 'window',
          row_number: row,
          position: 'A',
          is_available: true,
          price_modifier: 0
        });
        
        seats.push({
          route_id: routeId,
          seat_number: `${row}B`,
          seat_type: 'aisle',
          row_number: row,
          position: 'B',
          is_available: true,
          price_modifier: 0
        });
        
        // Right side seats (positions C and D)
        seats.push({
          route_id: routeId,
          seat_number: `${row}C`,
          seat_type: 'aisle',
          row_number: row,
          position: 'C',
          is_available: true,
          price_modifier: 0
        });
        
        seats.push({
          route_id: routeId,
          seat_number: `${row}D`,
          seat_type: 'window',
          row_number: row,
          position: 'D',
          is_available: true,
          price_modifier: 0
        });
      }

      const { error } = await supabase
        .from('seats')
        .insert(seats);

      if (error) {
        console.error('Error creating seats:', error);
        throw error;
      }

      console.log(`Created ${seats.length} seats for route ${routeId}`);
    } catch (error) {
      console.error('Error in createSeatsForRoute:', error);
      throw error;
    }
  },

  // Buscar layout de poltronas formatado para exibição
  async getSeatLayout(routeId: string): Promise<{ [key: number]: Seat[] }> {
    try {
      console.log('Getting seat layout for route:', routeId);
      
      const seats = await this.getAllSeatsForRoute(routeId);
      console.log('Seats retrieved for layout:', seats.length);
      
      const layout: { [key: number]: Seat[] } = {};
      
      // Group seats by row number
      seats.forEach(seat => {
        if (!layout[seat.row_number]) {
          layout[seat.row_number] = [];
        }
        layout[seat.row_number].push(seat);
      });
      
      // Sort seats within each row by position
      Object.keys(layout).forEach(rowKey => {
        const row = parseInt(rowKey);
        layout[row].sort((a, b) => {
          const positionOrder = { 'A': 1, 'B': 2, 'C': 4, 'D': 5 }; // Position 3 is aisle
          return positionOrder[a.position] - positionOrder[b.position];
        });
        
        // Add null for aisle (position 3)
        const sortedRow: (Seat | null)[] = [];
        layout[row].forEach(seat => {
          const positionOrder = { 'A': 1, 'B': 2, 'C': 4, 'D': 5 };
          const pos = positionOrder[seat.position];
          
          // Add aisle space before position C (position 4)
          if (pos === 4 && sortedRow.length === 2) {
            sortedRow.push(null); // Aisle
          }
          sortedRow.push(seat);
        });
        
        layout[row] = sortedRow as Seat[];
      });
      
      console.log('Layout created with rows:', Object.keys(layout).length);
      return layout;
    } catch (error) {
      console.error('Error getting seat layout:', error);
      throw error;
    }
  }
};