import axios from "axios";
import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Context } from "../main";
import { Navigate } from "react-router-dom";

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // New state for delete modal
  const [doctorToDelete, setDoctorToDelete] = useState(null); // Track which doctor to delete
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    doctorDepartment: "",
    nic: "",
    gender: "",
    docAvatar: null,
  });
  const { isAuthenticated } = useContext(Context);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data } = await axios.get(
          "http://localhost:4000/api/v1/user/doctors",
          { withCredentials: true }
        );
        setDoctors(data.doctors);
      } catch (error) {
        toast.error(error.response.data.message);
      }
    };
    fetchDoctors();
  }, []);

  const handleEdit = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      phone: doctor.phone,
      dob: doctor.dob.substring(0, 10),
      doctorDepartment: doctor.doctorDepartment,
      nic: doctor.nic,
      gender: doctor.gender,
      docAvatar: null,
    });
    setShowModal(true);
  };

  const handleDeleteClick = (doctorId) => {
    setDoctorToDelete(doctorId);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(
        `http://localhost:4000/api/v1/user/doctor/delete/${doctorToDelete}`,
        { withCredentials: true }
      );
      setDoctors(doctors.filter((doctor) => doctor._id !== doctorToDelete));
      toast.success("Doctor deleted successfully!");
      setShowDeleteModal(false);
      setDoctorToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete doctor");
      setShowDeleteModal(false);
      setDoctorToDelete(null);
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDoctorToDelete(null);
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "docAvatar") {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== "") {
          formDataToSend.append(key, formData[key]);
        }
      });

      const { data } = await axios.put(
        `http://localhost:4000/api/v1/user/doctor/update/${editingDoctor._id}`,
        formDataToSend,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Update the doctors list with the updated doctor
      setDoctors(
        doctors.map((doctor) =>
          doctor._id === editingDoctor._id ? data.doctor : doctor
        )
      );

      setShowModal(false);
      setEditingDoctor(null);
      toast.success("Doctor updated successfully!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update doctor");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDoctor(null);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dob: "",
      doctorDepartment: "",
      nic: "",
      gender: "",
      docAvatar: null,
    });
  };

  if (!isAuthenticated) {
    return <Navigate to={"/login"} />;
  }

  return (
    <section className="page doctors">
      <h1>DOCTORS</h1>
      <div className="banner">
        {doctors && doctors.length > 0 ? (
          doctors.map((element) => {
            return (
              <div className="card" key={element._id}>
                <div className="card-actions">
                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(element)}
                    title="Edit Doctor"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteClick(element._id)}
                    title="Delete Doctor"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
                <img
                  src={element.docAvatar && element.docAvatar.url}
                  alt="doctor avatar"
                />
                <h4>{`${element.firstName} ${element.lastName}`}</h4>
                <div className="details">
                  <p>
                    Email: <span>{element.email}</span>
                  </p>
                  <p>
                    Phone: <span>{element.phone}</span>
                  </p>
                  <p>
                    DOB: <span>{element.dob.substring(0, 10)}</span>
                  </p>
                  <p>
                    Department: <span>{element.doctorDepartment}</span>
                  </p>
                  <p>
                    NIC: <span>{element.nic}</span>
                  </p>
                  <p>
                    Gender: <span>{element.gender}</span>
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <h1>No Registered Doctors Found!</h1>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Doctor</h2>
              <button className="close-btn" onClick={closeModal}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select
                    name="doctorDepartment"
                    value={formData.doctorDepartment}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Department</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Oncology">Oncology</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Physical Therapy">Physical Therapy</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="ENT">ENT</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>NIC</label>
                  <input
                    type="text"
                    name="nic"
                    value={formData.nic}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Doctor Avatar</label>
                <input
                  type="file"
                  name="docAvatar"
                  onChange={handleInputChange}
                  accept="image/*"
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Update Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* delete model */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="close-btn" onClick={closeDeleteModal}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body" style={{ padding: "25px" }}>
              <p style={{ fontSize: "16px", marginBottom: "20px" }}>
                Are you sure you want to delete this doctor? This action cannot
                be undone.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="submit-btn"
                  style={{ backgroundColor: "#f44336" }}
                >
                  Delete Doctor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Doctors;
