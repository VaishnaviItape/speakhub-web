import React from 'react';
import noDataImg from '../../assets/no data.png';
import './EmptyState.css';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  imageSize?: number;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No Data Found",
  description = "There are no records available to display at this time.",
  actionText,
  onAction,
  imageSize = 160,
  className = ""
}) => {
  return (
    <div className={`empty-state-wrapper ${className}`}>
      <div className="empty-state-image-box">
        <img 
          src={noDataImg} 
          alt="No Data" 
          className="empty-state-img"
          style={{ maxWidth: imageSize, maxHeight: imageSize }}
        />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionText && onAction && (
        <button className="empty-state-btn" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
