import { createContext, useContext, useEffect, useState } from "react";

const DataContext = createContext();

export function DataProvider({ children }) {
  const [data, setData] = useState([]);
  const [ticketData, setTicketData] = useState([]);

  useEffect(() => {
    async function fetchMainData() {
      try {
        const res = await fetch("/api/Data/?start_date=0&end_date=1762629770");
        const json = await res.json();
        console.log(json);
        setData(json);
      } catch (err) {
        console.error("Failed to fetch main data:", err);
      }
    }

    fetchMainData();
  }, []); 

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await fetch("/api/Tickets");
        const json = await res.json();
        setTicketData(json.transport_tickets || []);
      } catch (err) {
        console.error("Failed to fetch ticket data:", err);
      }
    }

    fetchTickets();
  }, []); 

  return (
    <DataContext.Provider value={{ data, ticketData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}

