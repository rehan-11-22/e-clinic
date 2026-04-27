// context/DoctorsContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const DoctorsContext = createContext();

export const DoctorsProvider = ({ children }) => {
  const [doctors, setDoctors] = useState([]);
  const [loaded, setLoaded] = useState(false); // Prevent re-fetching
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      if (loaded) return; // Prevent duplicate fetch
      try {
        const { data } = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/v1/user/doctors`
        );
        setDoctors(data.doctors);
        setLoaded(true);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to fetch doctors."
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchDoctors();
  }, [loaded]);

  return (
    <DoctorsContext.Provider value={{ doctors, isLoading }}>
      {children}
    </DoctorsContext.Provider>
  );
};

export const useDoctors = () => useContext(DoctorsContext);
