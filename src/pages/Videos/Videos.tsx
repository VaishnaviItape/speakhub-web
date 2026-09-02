import React, { useState, useEffect } from 'react';
import { Plus, Video, ExternalLink, Trash2, Edit3, Film, Play } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getYouTubeVideoId, getYouTubeThumbnail } from '../../utils/youtube';
import './Videos.css';

export interface YouTubeVideoItem {
  id?: string;
  title: string;
  youtubeUrl: string;
  category: string;
  batchId?: string;
  batchName?: string;
  description?: string;
  createdAt?: any;
}

const DEFAULT_SEED_VIDEOS: Omit<YouTubeVideoItem, 'id'>[] = [
  {
    title: 'Speak Hub Spoken English & Fluency Masterclass',
    youtubeUrl: 'https://youtu.be/Uhg80b2TJVs?si=38ohmD_0kXfjgDhl',
    category: 'New Batch Demo',
    description: 'Learn fundamental spoken English concepts, conversation skills and daily speaking practice.',
  },
  {
    title: 'English Speaking Practice & Pronunciation Guide',
    youtubeUrl: 'https://youtu.be/nFfnnaJFV_U?si=ckhBwk4sW1mYbZQw',
    category: 'Spoken English',
    description: 'Clear pronunciation, sentence formation, and practical fluency tips for learners.',
  },
  {
    title: 'Public Speaking, Confidence & Grammar Essentials',
    youtubeUrl: 'https://youtu.be/Rax0DFWQ5qc?si=a6MQlguJSlIIbWol',
    category: 'Masterclass',
    description: 'Master public speaking confidence and overcome hesitation while speaking in English.',
  }
];

const Videos: React.FC = () => {
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [batches, setBatches] = useState<{ id: string; batchName: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [category, setCategory] = useState('New Batch Demo');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [description, setDescription] = useState('');

  const fetchBatches = async () => {
    try {
      const bSnap = await getDocs(collection(db, 'batches'));
      const bList: { id: string; batchName: string }[] = [];
      bSnap.forEach(d => {
        const data = d.data();
        bList.push({ id: d.id, batchName: data.batchName || 'Batch ' + d.id });
      });
      setBatches(bList);
    } catch (e) {
      console.error("Error fetching batches:", e);
    }
  };

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'youtube_videos'));
      const snapshot = await getDocs(q);
      const list: YouTubeVideoItem[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() } as YouTubeVideoItem);
      });

      // If empty, auto-seed default videos
      if (list.length === 0) {
        for (const seed of DEFAULT_SEED_VIDEOS) {
          const docRef = await addDoc(collection(db, 'youtube_videos'), {
            ...seed,
            createdAt: serverTimestamp()
          });
          list.push({ id: docRef.id, ...seed });
        }
      }

      setVideos(list);
    } catch (err) {
      console.error("Error fetching videos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchVideos();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setTitle('');
    setYoutubeUrl('');
    setCategory('New Batch Demo');
    setSelectedBatchId('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: YouTubeVideoItem) => {
    setEditingId(v.id || null);
    setTitle(v.title || '');
    setYoutubeUrl(v.youtubeUrl || '');
    setCategory(v.category || 'New Batch Demo');
    setSelectedBatchId(v.batchId || '');
    setDescription(v.description || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this YouTube video? It will also be removed from the Mobile App.")) return;
    try {
      await deleteDoc(doc(db, 'youtube_videos', id));
      setVideos(prev => prev.filter(item => item.id !== id));
    } catch (e: any) {
      alert("Error deleting video: " + e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !youtubeUrl.trim()) {
      alert("Please provide both title and a YouTube URL.");
      return;
    }

    const vidId = getYouTubeVideoId(youtubeUrl);
    if (!vidId) {
      alert("Invalid YouTube URL. Please enter a valid link (e.g. https://youtu.be/... or https://www.youtube.com/watch?v=...)");
      return;
    }

    setIsSaving(true);
    try {
      const selectedBatch = batches.find(b => b.id === selectedBatchId);
      const payload: any = {
        title: title.trim(),
        youtubeUrl: youtubeUrl.trim(),
        category,
        batchId: selectedBatchId || '',
        batchName: selectedBatch?.batchName || '',
        description: description.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'youtube_videos', editingId), payload);
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'youtube_videos'), payload);
      }

      await fetchVideos();
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Error saving video: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const currentParsedId = getYouTubeVideoId(youtubeUrl);

  return (
    <div className="videos-page-container">
      <div className="videos-header">
        <div>
          <h1 className="videos-title">YouTube Videos & Masterclasses</h1>
          <p className="videos-subtitle">
            Share YouTube video links for new batches & lectures. These will be visible directly on the mobile app.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} />
          Add YouTube Video
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading videos...</p>
        </div>
      ) : videos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <Film size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
          <h3 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem' }}>No YouTube Videos Shared Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Add video links so students can watch them on the mobile app.</p>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add First Video
          </button>
        </div>
      ) : (
        <div className="videos-grid">
          {videos.map((v) => {
            const thumb = getYouTubeThumbnail(v.youtubeUrl);
            return (
              <div key={v.id} className="video-admin-card">
                <div className="video-thumbnail-wrapper">
                  {thumb ? (
                    <img src={thumb} alt={v.title} className="video-thumbnail-img" />
                  ) : (
                    <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', color: '#94a3b8' }}>
                      <Video size={36} />
                    </div>
                  )}
                  <span className="video-category-tag">{v.category || 'VIDEO'}</span>
                  <a 
                    href={v.youtubeUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="video-play-overlay"
                    title="Watch on YouTube"
                  >
                    <div className="play-button-icon">
                      <Play size={20} fill="#ffffff" />
                    </div>
                  </a>
                </div>

                <div className="video-card-body">
                  <h3 className="video-card-title">{v.title}</h3>
                  <p className="video-card-desc">
                    {v.description || (v.batchName ? `Batch: ${v.batchName}` : 'Available on Mobile App & YouTube')}
                  </p>

                  <div className="video-card-meta">
                    <span>{v.batchName ? `Batch: ${v.batchName}` : 'General Masterclass'}</span>
                    <div className="video-card-actions">
                      <a 
                        href={v.youtubeUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="video-action-btn"
                        title="Open on YouTube"
                      >
                        <ExternalLink size={13} />
                        View
                      </a>
                      <button 
                        className="video-action-btn"
                        onClick={() => handleOpenEdit(v)}
                        title="Edit video"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        className="video-action-btn delete"
                        onClick={() => handleDelete(v.id)}
                        title="Delete video"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit YouTube Video' : 'Add New YouTube Video'}
      >
        <form onSubmit={handleSubmit} className="video-form">
          <Input
            label="Video Title *"
            placeholder="e.g. New Batch Spoken English Orientation & Demo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Input
            label="YouTube Video Link *"
            placeholder="e.g. https://youtu.be/Uhg80b2TJVs"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            required
          />

          {currentParsedId ? (
            <div className="video-preview-box">
              <img 
                src={`https://img.youtube.com/vi/${currentParsedId}/hqdefault.jpg`} 
                alt="Thumbnail preview" 
                className="video-preview-thumb"
              />
              <div className="video-preview-info">
                <span>Detected YouTube ID: </span>
                <span className="video-preview-id">{currentParsedId}</span>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#16a34a' }}>✓ Ready to display on mobile app</p>
              </div>
            </div>
          ) : null}

          <Select
            label="Category / Video Tag *"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { label: 'New Batch Demo & Orientation', value: 'New Batch Demo' },
              { label: 'Spoken English & Fluency', value: 'Spoken English' },
              { label: 'Grammar & Foundations', value: 'Grammar' },
              { label: 'Public Speaking & Confidence', value: 'Masterclass' },
              { label: 'Pronunciation Workshop', value: 'Pronunciation' },
              { label: 'Free Lecture', value: 'Free Lecture' },
            ]}
          />

          <Select
            label="Link to Batch (Optional)"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            options={[
              { label: 'None (General Masterclass for all students)', value: '' },
              ...batches.map(b => ({ label: b.batchName, value: b.id }))
            ]}
          />

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
              Description / Notes (Optional)
            </label>
            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: '70px', padding: '8px 12px', boxSizing: 'border-box', fontFamily: 'inherit', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
              placeholder="What will students learn in this video?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="modal-form-footer">
            <button 
              type="button" 
              className="btn-modal-cancel" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-modal-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Video' : 'Add Video'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Videos;
