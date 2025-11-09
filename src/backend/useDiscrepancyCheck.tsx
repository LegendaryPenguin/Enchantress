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
      
      // get all the tickets that match the dates
      const matching_tickets = cauldron_ticket_data.filter(
        ticket => ticket.date === prev.timestamp.slice(0, 10)
      );

      console.log("matching_tickets: ", matching_tickets)

      const seenTickets = new Set();

      if (matching_tickets.length === 0) {
        // Condition 1: decrease without tickets
        const key = prev.timestamp + "_" + cauldron;
        if (!seenTickets.has(key)) {
          discrepancy_list.push({
            timestamp: prev.timestamp,
            cauldron_id: cauldron,
            lost_amount,
            isDiscrepancy: true,
          });
          seenTickets.add(key);
        }
      } else {
        const hasMatchingTicket = matching_tickets.some(
          ticket => Math.abs(ticket.amount_collected - lost_amount) <= 10
        );

        if (!hasMatchingTicket) {
          // none of the tickets match => mark all as discrepancies if not already
          matching_tickets.forEach(ticket => {
            if (ticket.isDiscrepancy === null) ticket.isDiscrepancy = true;

            if (!seenTickets.has(ticket.ticket_id)) {
              discrepancy_list.push(ticket);
              seenTickets.add(ticket.ticket_id);
            }
          });
        } else {
          // mark tickets that do match as not a discrepancy if not set yet
          matching_tickets.forEach(ticket => {
            if (ticket.isDiscrepancy === null) ticket.isDiscrepancy = false;
          });
        }
      }
      /*if (matching_tickets.length === 0) {
        // Condition 1: decrease happened but no tickets exist
        discrepancy_list.push({
          timestamp: prev.timestamp,
          cauldron_id: cauldron,
          lost_amount,
          isDiscrepancy: true, 
        });
      }
      else {
        const hasMatchingTicket = matching_tickets.some(
          ticket => Math.abs(ticket.amount_collected - lost_amount) <= 10
        );

        console.log("hasMatchingTicket", hasMatchingTicket)

        if (!hasMatchingTicket) {

          // none of the tickets match => mark all as discrepancies if not already
          matching_tickets.forEach(ticket => {
            if (ticket.isDiscrepancy === null) {
              ticket.isDiscrepancy = true;
            }
            discrepancy_list.push(ticket);
          });

        } else {
          // mark tickets that do match as not a discrepancy if not set yet
          matching_tickets.forEach(ticket => {
            if (ticket.isDiscrepancy === null) ticket.isDiscrepancy = false;
          });
        }*/
      /*
      matching_tickets.forEach(ticket => {
        const diff = Math.abs(ticket.amount_collected - lost_amount);

        if (diff > 10) {
          if (ticket.isDiscrepancy === null){
            console.log("lost_amount: ", lost_amount)
            ticket.isDiscrepancy = true;  
            discrepancy_list.push(ticket);
          }
        } else {
          if (ticket.isDiscrepancy === null){
            ticket.isDiscrepancy = false; 
          }
        }
      });*/

      // add to list of discrepencies
  console.log("discrepancy list: ", discrepancy_list)
  return discrepancy_list

    }
  }
    }
  
}
