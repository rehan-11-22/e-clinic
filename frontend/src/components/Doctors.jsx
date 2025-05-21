import React, { useState } from "react";
import { useDoctors } from "../context/DoctorsContext";

const fallbackImage = "/contact.png"; // Ensure it's in the public folder

const departments = [
  "Pediatrics",
  "Orthopedics",
  "Cardiology",
  "Neurology",
  "Oncology",
  "Radiology",
  "Physical Therapy",
  "Dermatology",
  "ENT",
];

const Doctors = () => {
  const { doctors } = useDoctors();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [visibleCount, setVisibleCount] = useState(6); // Show 6 doctors initially

  // Filter logic
  const filteredDoctors = doctors.filter((doc) => {
    const matchesDepartment = selectedDepartment
      ? doc.doctorDepartment?.toLowerCase() === selectedDepartment.toLowerCase()
      : true;
    const matchesSearch = `${doc.firstName} ${doc.lastName}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchesDepartment && matchesSearch;
  });

  const visibleDoctors = filteredDoctors.slice(0, visibleCount);

  return (
    <section className="doctor-page doctors">
      <h2>OUR DOCTORS</h2>

      {/* Filter Controls */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search doctors by name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "1rem",
            flex: 1,
            borderRadius: "25px",
            border: "1.4px solid black",
          }}
        />
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          style={{
            padding: "1rem 0.2rem 1rem 0.2rem",
            borderRadius: "5px",
            // border: "1.4px solid black",
          }}
        >
          <option value="">All Departments</option>
          {departments.map((dep) => (
            <option key={dep} value={dep}>
              {dep}
            </option>
          ))}
        </select>
      </div>

      <div className="doctor-banner">
        {visibleDoctors.length > 0 ? (
          visibleDoctors.map((element, index) => (
            <div className="doctor-card" key={element._id || index}>
              <img
                src={element.docAvatar?.url || fallbackImage}
                alt="doctor avatar"
                onError={(e) => (e.target.src = fallbackImage)}
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
          <h1>No Doctors Found!</h1>
        )}
      </div>

      {/* Load More Button */}
      {visibleCount < filteredDoctors.length && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            onClick={() => setVisibleCount(visibleCount + 6)}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Load More
          </button>
        </div>
      )}
    </section>
  );
};

export default Doctors;
