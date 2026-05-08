import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'react-toastify';
import EmployeeIdCard from './EmployeeIdCard';
import './IdCardModal.css';

const IdCardModal = ({ isOpen, onClose, admin }) => {
  const cardRef = useRef(null);
  
  if (!isOpen) return null;

  const handleDownloadPDF = async () => {
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 54] // Credit card size
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);
      pdf.save(`${admin.firstName}_${admin.lastName}_ID_Card.pdf`);
      toast.success('ID Card downloaded as PDF successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  const handleDownloadPNG = async () => {
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `${admin.firstName}_${admin.lastName}_ID_Card.png`;
      link.href = canvas.toDataURL();
      link.click();
      toast.success('ID Card downloaded as PNG successfully!');
    } catch (error) {
      console.error('Error generating PNG:', error);
      toast.error('Failed to download PNG. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="id-card-modal-overlay" onClick={onClose}>
      <div className="id-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Employee ID Card</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="id-card-container" ref={cardRef}>
            <EmployeeIdCard admin={admin} />
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="btn btn-primary" onClick={handleDownloadPNG}>
            📷 Download PNG
          </button>
          <button className="btn btn-success" onClick={handleDownloadPDF}>
            📄 Download PDF
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdCardModal;