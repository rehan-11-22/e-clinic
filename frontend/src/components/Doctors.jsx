import axios from "axios";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

const fallbackImage = "/public/contact.png"; // Ensure this exists in the public folder

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data } = await axios.get(
          "http://localhost:4000/api/v1/user/doctors"
        );
        console.log("Fetched doctors:", data.doctors); // Debugging
        setDoctors(data.doctors);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to fetch doctors."
        );
      }
    };
    fetchDoctors();
  }, []);

  return (
    <section className="doctor-page doctors">
      <h2>OUR DOCTORS</h2>
      <div className="doctor-banner">
        {doctors.length > 0 ? (
          doctors.map((element, index) => (
            <div className="doctor-card" key={element._id || index}>
              {console.log("Doctor Avatar URL:", element.docAvatar?.url)}{" "}
              {/* Debugging */}
              <img
                src={element.docAvatar?.url || fallbackImage}
                alt="doctor avatar"
                onError={(e) => (e.target.src = fallbackImage)} // Handle broken images
              />
              <h5>{`${element.firstName} ${element.lastName}`}</h5>
              <div className="doctor-details">
                <p>
                  Department: <span>{element.doctorDepartment || "N/A"}</span>
                </p>
                <p>
                  Gender: <span>{element.gender || "N/A"}</span>
                </p>
              </div>
            </div>
          ))
        ) : (
          <h1>No Registered Doctors Found!</h1>
        )}
      </div>
    </section>
  );
};

export default Doctors;
