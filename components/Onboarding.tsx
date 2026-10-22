
import React, { useState, useEffect } from 'react';
import type { UserProfile } from '../services/types.ts';
import { Zap, Bot, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { guessOwnerFirstName } from '../services/phoneLibrary.ts';

interface OnboardingProps {
  onProfileSave: (profile: UserProfile) => void;
}

const FeatureCard = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center">
      <div className="mb-4 text-secondary">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{children}</p>
    </div>
);

const Onboarding: React.FC<OnboardingProps> = ({ onProfileSave }) => {
  const [firstName, setFirstName] = useState('');

  // Android app: suggest the name found in the phone's name ("Alex's Pixel")
  useEffect(() => {
    guessOwnerFirstName().then(name => { if (name) setFirstName(current => current || name); });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim()) {
      const newProfile: UserProfile = {
        firstName: firstName.trim(),
        classificationRules: [
          {id: '1', label: 'cat', confidence: 80},
          {id: '2', label: 'dog', confidence: 80},
        ],
        detectionRules: [
          {id: '3', label: 'person', confidence: 75},
          {id: '4', label: 'car', confidence: 75},
        ],
        customLabels: [
          { id: 'cl-animals-default', name: 'Animals', labels: ['cat', 'dog'] }
        ],
        autoApplyRules: true,
        unknownThreshold: 10,
        thumbnailSize: 'M',
        savedFolderName: 'saves',
        savedOperation: 'move',
        blurThreshold: 100,
        sharpThreshold: 300,
      };
      onProfileSave(newProfile);
    }
  };

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
        <main className="container mx-auto px-6 py-16 text-center">

          {/* Hero Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="flex justify-center items-center mb-6">
              <img src="/logo.png" alt="Logo Pixo" className="w-24 h-24" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-primary dark:text-primary-light mb-4 leading-tight">
              Welcome to Pixo
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-12">
              Organize your photos effortlessly.
              <br/>
              Automatically categorize your local photos with powerful AI, right in your browser.
              <br/>
              No uploads, total privacy.
            </p>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
            <FeatureCard icon={<Bot className="w-10 h-10" />} title="Automatic Tagging">
              Leverage state-of-the-art AI to scan and label your photos based on their content.
            </FeatureCard>
            <FeatureCard icon={<ShieldCheck className="w-10 h-10" />} title="100% Private">
              Your photos are processed entirely on your device. Nothing is ever uploaded to a server.
            </FeatureCard>
            <FeatureCard icon={<SlidersHorizontal className="w-10 h-10" />} title="Powerful Rules">
              Create custom rules to automatically select photos that match your criteria for easy organization.
            </FeatureCard>
          </div>

          {/* Call to Action Section */}
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800/50 p-8 rounded-xl shadow-2xl ring-1 ring-primary/20">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Ready to Get Started?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Let's begin by setting up your profile. What should I call you?
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name..."
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none transition"
                  required
              />
              <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                Start Organizing <Zap className="w-5 h-5" />
              </button>
            </form>
          </div>
        </main>

        <footer className="text-center py-8 text-sm text-gray-500">
          <p>Powered by Alexandre Rodenas</p>
        </footer>
      </div>
  );
};

export default Onboarding;
