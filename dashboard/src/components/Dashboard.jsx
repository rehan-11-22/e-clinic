import React, { useContext, useEffect, useState } from "react";
import { Context } from "../main";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { GoCheckCircleFill } from "react-icons/go";
import { AiFillCloseCircle } from "react-icons/ai";

const StatusModal = ({ isOpen, onClose, appointment, status, onConfirm }) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [customTime, setCustomTime] = useState("");

  useEffect(() => {
    if (isOpen && status !== "Rejected") {
      setSelectedDate(new Date().toISOString().split("T")[0]);
      setSelectedTimes([]);
    }
  }, [isOpen, status]);

  const addCustomTime = () => {
    if (customTime && !selectedTimes.includes(customTime)) {
      setSelectedTimes((prev) => [...prev, customTime]);
      setCustomTime("");
    }
  };

  const removeTime = (timeToRemove) => {
    setSelectedTimes(selectedTimes.filter((time) => time !== timeToRemove));
  };

  const handleConfirm = () => {
    const slots =
      status !== "Rejected"
        ? {
            date: selectedDate,
            times: selectedTimes,
          }
        : null;

    onConfirm(slots);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>
          {status === "Accepted" && "Confirm Appointment"}
          {status === "Pending" && "Set Available Slots"}
          {status === "Rejected" && "Reject Appointment"}
        </h3>

        <div className="appointment-info">
          <p>
            <strong>Patient:</strong> {appointment?.firstName}{" "}
            {appointment?.lastName}
          </p>
          <p>
            <strong>Email:</strong> {appointment?.email}
          </p>
          <p>
            <strong>Doctor:</strong> Dr. {appointment?.doctor?.firstName}{" "}
            {appointment?.doctor?.lastName}
          </p>
          <p>
            <strong>Department:</strong> {appointment?.department}
          </p>
        </div>

        {(status === "Accepted" || status === "Pending") && (
          <>
            <h4>
              {status === "Accepted"
                ? "Confirm Appointment Time"
                : "Set Available Slots"}
            </h4>
            <div className="form-group">
              <label>Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>
                {status === "Accepted" ? "Appointment Time" : "Available Times"}
                :
              </label>

              <div className="time-input-group">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addCustomTime}
                  className={`add-time-btn ${
                    status === "Accepted" ? "accepted" : "pending"
                  }`}
                >
                  Add Time
                </button>
              </div>

              {selectedTimes.length > 0 && (
                <div className="selected-times">
                  <h5>Selected Times:</h5>
                  <div className="times-list">
                    {selectedTimes.map((time) => (
                      <div
                        key={time}
                        className={`time-chip ${
                          status === "Accepted" ? "accepted" : "pending"
                        }`}
                      >
                        <span>{time}</span>
                        <button
                          onClick={() => removeTime(time)}
                          className="remove-time"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {status === "Pending" && (
              <p className="info-text">
                We will notify the patient about these available slots and
                confirm the final appointment time.
              </p>
            )}
          </>
        )}

        {status === "Rejected" && (
          <div className="reject-confirmation">
            <p>
              Are you sure you want to reject this appointment? We will send an
              email to the patient informing them about the rejection.
            </p>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              status !== "Rejected" &&
              (!selectedDate || selectedTimes.length === 0)
            }
            className={`confirm-btn ${
              status === "Accepted"
                ? "accepted"
                : status === "Pending"
                ? "pending"
                : "rejected"
            }`}
          >
            {status === "Accepted" && "Confirm Appointment"}
            {status === "Pending" && "Set Available Slots"}
            {status === "Rejected" && "Reject Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const { isAuthenticated, admin } = useContext(Context);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const { data } = await axios.get(
          "http://localhost:4000/api/v1/appointment/getall",
          { withCredentials: true }
        );
        // Sort appointments by date in descending order (newest first)
        const sortedAppointments = data.appointments.sort((a, b) => {
          return new Date(b.appointment_date) - new Date(a.appointment_date);
        });
        setAppointments(sortedAppointments);
      } catch (error) {
        setAppointments([]);
      }
    };
    fetchAppointments();
  }, []);

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

  const handleStatusChange = (appointment, newStatus) => {
    if (appointment.status !== newStatus) {
      setSelectedAppointment(appointment);
      setSelectedStatus(newStatus);
      setModalOpen(true);
    }
  };

  const handleConfirmStatusChange = async (slots) => {
    try {
      const { data } = await axios.put(
        `http://localhost:4000/api/v1/appointment/update/${selectedAppointment._id}`,
        {
          status: selectedStatus,
          ...(slots && { availableSlots: slots }),
        },
        { withCredentials: true }
      );

      // Send email notification
      await axios.post(
        "http://localhost:4000/api/v1/email/send",
        {
          appointmentId: selectedAppointment._id,
          status: selectedStatus,
          availableSlots: slots,
        },
        { withCredentials: true }
      );

      setAppointments((prevAppointments) =>
        prevAppointments.map((appointment) =>
          appointment._id === selectedAppointment._id
            ? { ...appointment, status: selectedStatus }
            : appointment
        )
      );

      toast.success(data.message);
      setModalOpen(false);
      setSelectedAppointment(null);
      setSelectedStatus("");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update appointment"
      );
    }
  };

  if (!isAuthenticated) {
    return <Navigate to={"/login"} />;
  }

  return (
    <>
      <section className="dashboard page">
        <div className="banner">
          <div className="firstBox">
            <img src="/doc.png" alt="docImg" />
            <div className="content">
              <div>
                <p>Hello ,</p>
                <h5>{admin && `${admin.firstName} ${admin.lastName}`} </h5>
              </div>
              <p>
                You're now logged into the E-Cure Hub Medical Admin Panel. From
                here, you have full control over managing doctors, appointments
                and platform content.
              </p>
            </div>
          </div>
          <div className="secondBox">
            <p>Total Appointments</p>
            <h3>{appointments.length}</h3>
          </div>
          <div className="thirdBox">
            <p>Registered Doctors</p>
            <h3>{doctors.length}</h3>
          </div>
        </div>
        <div className="banner">
          <h5>Appointments</h5>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Date</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Status</th>
                <th>Visited</th>
              </tr>
            </thead>
            <tbody>
              {appointments && appointments.length > 0 ? (
                appointments.map((appointment) => (
                  <tr key={appointment._id}>
                    <td>{`${appointment.firstName} ${appointment.lastName}`}</td>
                    <td>{appointment.appointment_date.substring(0, 16)}</td>
                    <td>{`${appointment.doctor.firstName} ${appointment.doctor.lastName}`}</td>
                    <td>{appointment.department}</td>
                    <td>
                      <select
                        className={
                          appointment.status === "Pending"
                            ? "value-pending"
                            : appointment.status === "Accepted"
                            ? "value-accepted"
                            : "value-rejected"
                        }
                        value={appointment.status}
                        onChange={(e) =>
                          handleStatusChange(appointment, e.target.value)
                        }
                      >
                        <option value="Pending" className="value-pending">
                          Pending
                        </option>
                        <option value="Accepted" className="value-accepted">
                          Accepted
                        </option>
                        <option value="Rejected" className="value-rejected">
                          Rejected
                        </option>
                      </select>
                    </td>
                    <td>
                      {appointment.hasVisited === true ? (
                        <GoCheckCircleFill className="green" />
                      ) : (
                        <AiFillCloseCircle className="red" />
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No Appointments Found!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <StatusModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedAppointment(null);
          setSelectedStatus("");
        }}
        appointment={selectedAppointment}
        status={selectedStatus}
        onConfirm={handleConfirmStatusChange}
      />
    </>
  );
};

export default Dashboard;
