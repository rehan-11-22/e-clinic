// context/DoctorsContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const DoctorsContext = createContext();

export const DoctorsProvider = ({ children }) => {
  const [doctors, setDoctors] = useState([]);
  const [loaded, setLoaded] = useState(false); // Prevent re-fetching

  useEffect(() => {
    const fetchDoctors = async () => {
      if (loaded) return; // Prevent duplicate fetch
      try {
        const { data } = await axios.get(
          "http://localhost:4000/api/v1/user/doctors"
        );
        setDoctors(data.doctors);
        setLoaded(true);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to fetch doctors."
        );
      }
    };

    fetchDoctors();
  }, [loaded]);

  return (
    <DoctorsContext.Provider value={{ doctors }}>
      {children}
    </DoctorsContext.Provider>
  );
};

export const useDoctors = () => useContext(DoctorsContext);
