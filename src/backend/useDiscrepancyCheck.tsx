import { useState, useEffect } from "react";
import { useData } from './FetchContext';

export function useDiscrepancyCheck(cauldron){
  const {data, ticketData} = useData();
  console.log(data);
  console.log("ticket data: ", ticketData);
  const cauldron_data = data.map(item => ({
    timestamp: item.timestamp,
    value: item.cauldron_levels[cauldron]
  }));

  const cauldron_ticket_data = ticketData
  .filter(ticket => ticket.cauldron_id === cauldron)
  .map(ticket => ({
    ...ticket,             
    isDiscrepancy: null,  
  }));

  console.log(cauldron_data)
  console.log(cauldron_ticket_data)

  const discrepancy_list = []; 
  const seenTickets = new Set();

  for (let i = 1; i < cauldron_data.length; i++){
    let prev = cauldron_data[i - 1];
    let curr = cauldron_data[i];

    if (!curr || !prev) continue; 

    if (curr.value < prev.value){
      let lost_amount = 0

      // while it is decreasing, increase i
      while (curr && curr.value < prev.value) {
        // calculate the expected
        // no need to subtract or add rate, because its applied to prev and curr
        lost_amount += (prev.value - curr.value);
        i++;
        prev = cauldron_data[i - 1];
        curr = cauldron_data[i];
      }

      if (lost_amount < 1) { continue; }
      
      // get all the tickets that match the dates
      const matching_tickets = cauldron_ticket_data.filter(
        ticket => ticket.date === prev.timestamp.slice(0, 10)
      );

      console.log("matching_tickets: ", matching_tickets)

      if (matching_tickets.length === 0) {
        const key = prev.timestamp + "_" + cauldron;
        if (!seenTickets.has(key)) {
          discrepancy_list.push({
            timestamp: prev.timestamp,
            error_type: "Unlogged Potion Drain",
            volume_diff: lost_amount,
            cauldron_id: cauldron,
            lost_amount,
            isDiscrepancy: true,
          });
          seenTickets.add(key);
        }
      } else {
        const hasMatchingTicket = matching_tickets.some(
          ticket => Math.abs(ticket.amount_collected - lost_amount) <= 15
        );

        if (!hasMatchingTicket) {
          matching_tickets.forEach(ticket => {
            if (ticket.isDiscrepancy === null) ticket.isDiscrepancy = true;

            if (!seenTickets.has(ticket.ticket_id)) {
              //discrepancy_list.push(ticket);
              discrepancy_list.push({
                timestamp: prev.timestamp,
                error_type: "Incorrect Potion Ticket",
                volume_diff: lost_amount - ticket.amount_collected,
                cauldron_id: cauldron,
                lost_amount,
                isDiscrepancy: true,
              });
              seenTickets.add(ticket.ticket_id);
            }
          });
        } else {
          matching_tickets.forEach(ticket => {
            if (ticket.isDiscrepancy === null) ticket.isDiscrepancy = false;
          });
        }
      }
    }
  }
  const unique_discrepancies = Array.from(
    new Map(
      discrepancy_list.map(d => [
        `${d.timestamp}_${d.cauldron_id}_${d.lost_amount.toFixed(6)}`,
        d
      ])
    ).values()
  );

  console.log("discrepancy list: ", discrepancy_list)
  console.log("unique list: ", unique_discrepancies)
  return unique_discrepancies
}
