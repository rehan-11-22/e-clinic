import React, { useState, useMemo, useEffect, memo } from "react";
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
  "Veterinary",
];

// Production-Level Optimization: Memoized Doctor Card Component
const DoctorCard = memo(({ element }) => {
  // Optimize image size to prevent massive scroll jank from large images
  let imageUrl = element.docAvatar?.url || fallbackImage;
  if (imageUrl.includes("cloudinary.com") && imageUrl.includes("/upload/")) {
    imageUrl = imageUrl.replace("/upload/", "/upload/w_250,h_250,c_fill,q_auto,f_auto/");
  }

  return (
    <div className="doctor-card" style={{ willChange: "transform", transform: "translateZ(0)" }}>
      <img
        src={imageUrl}
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
  );
});
DoctorCard.displayName = "DoctorCard";

const Doctors = () => {
  const { doctors, isLoading } = useDoctors();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [visibleCount, setVisibleCount] = useState(8); // Show 8 doctors initially
  const [isRendering, setIsRendering] = useState(true);

  // Defer heavy rendering to prevent navigation freeze
  useEffect(() => {
    const timer = setTimeout(() => setIsRendering(false), 50);
    return () => clearTimeout(timer);
  }, []);

  // Filter logic (Wrapped in useMemo for production-level performance)
  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter((doc) => {
      const matchesDepartment = selectedDepartment
        ? doc.doctorDepartment?.toLowerCase() === selectedDepartment.toLowerCase()
        : true;
      const matchesSearch = `${doc.firstName} ${doc.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      return matchesDepartment && matchesSearch;
    });
  }, [doctors, selectedDepartment, searchTerm]);

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
        {isLoading || isRendering ? (
          <div style={{ width: "100%", gridColumn: "1 / -1", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px", flexDirection: "column", gap: "15px" }}>
            <div className="spinner" style={{ width: "50px", height: "50px", border: "5px solid #f3f3f3", borderTop: "5px solid #271776ca", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <h3 style={{ color: "gray" }}>Loading Doctors...</h3>
            <style>
              {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
            </style>
          </div>
        ) : visibleDoctors.length > 0 ? (
          visibleDoctors.map((element, index) => (
            <DoctorCard key={element._id || index} element={element} />
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
