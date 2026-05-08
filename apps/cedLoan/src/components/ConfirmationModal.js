import React from 'react';
import Modal from './Modal';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  phoneNumber, 
  loading = false,
  title = "Confirm Phone Number",
  message = "Is this phone number correct?"
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
        <p className="text-gray-600 mb-2">{message}</p>
        <p className="text-2xl font-bold text-cedi-blue mb-6">{phoneNumber}</p>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors duration-200"
            disabled={loading}
          >
            Edit
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cedi-blue to-cedi-dark text-white rounded-xl font-semibold hover:from-cedi-dark hover:to-cedi-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? 'Sending...' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;