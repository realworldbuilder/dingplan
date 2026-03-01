import { AuthService, type AuthUser } from '../services/authService';
import { AuthModal } from './AuthModal';

export class UserIndicator {
  private container: HTMLElement;
  private authModal: AuthModal;
  private currentUser: AuthUser | null = null;

  constructor() {
    this.authModal = new AuthModal();
    this.createUserIndicator();
    this.setupAuthStateListener();
    this.initializeUser();
  }

  private createUserIndicator() {
    // Find the toolbar
    const toolbar = document.getElementById('toolbar-html');
    if (!toolbar) {
      console.error('Toolbar not found for user indicator');
      return;
    }

    // Create user indicator container
    this.container = document.createElement('div');
    this.container.id = 'user-indicator';
    this.container.style.cssText = `
      margin-left: 8px;
      padding-left: 8px;
      border-left: 1px solid #e1e5e9;
      display: flex;
      align-items: center;
    `;

    // Add to toolbar
    toolbar.appendChild(this.container);
    
    this.renderUserState();
  }

  private renderUserState() {
    if (!this.container) return;

    if (this.currentUser) {
      // Show signed-in state
      this.container.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 6px;
          transition: background-color 0.2s ease;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: rgba(33, 150, 243, 0.1);
        " class="user-info">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #2196F3;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
          ">
            ${this.currentUser.email.charAt(0).toUpperCase()}
          </div>
          <div style="
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            max-width: 120px;
          ">
            <div style="
              font-weight: 500;
              color: #333;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
              line-height: 1;
            ">
              ${this.currentUser.email.split('@')[0]}
            </div>
            <div style="
              font-size: 10px;
              color: #666;
              line-height: 1;
              margin-top: 2px;
            ">
              Click to sign out
            </div>
          </div>
        </div>
      `;

      // Add click handler for sign out
      const userInfo = this.container.querySelector('.user-info') as HTMLElement;
      if (userInfo) {
        userInfo.addEventListener('click', () => this.signOut());
        userInfo.addEventListener('mouseenter', () => {
          userInfo.style.backgroundColor = 'rgba(33, 150, 243, 0.15)';
        });
        userInfo.addEventListener('mouseleave', () => {
          userInfo.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
        });
      }
    } else {
      // Show sign-in button
      this.container.innerHTML = `
        <button class="sign-in-btn" style="
          background: #2196F3;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        ">
          Sign In
        </button>
      `;

      // Add click handler for sign in
      const signInBtn = this.container.querySelector('.sign-in-btn') as HTMLElement;
      if (signInBtn) {
        signInBtn.addEventListener('click', () => this.authModal.open('signin'));
        signInBtn.addEventListener('mouseenter', () => {
          signInBtn.style.backgroundColor = '#1976D2';
        });
        signInBtn.addEventListener('mouseleave', () => {
          signInBtn.style.backgroundColor = '#2196F3';
        });
      }
    }
  }

  private setupAuthStateListener() {
    // Listen for auth state changes
    AuthService.onAuthStateChange((user) => {
      this.currentUser = user;
      this.renderUserState();
    });

    // Also listen for auth changes from the modal
    this.authModal.onAuthStateChange((user) => {
      this.currentUser = user;
      this.renderUserState();
    });
  }

  private async initializeUser() {
    // Get current user on initialization
    try {
      this.currentUser = await AuthService.getUser();
      this.renderUserState();
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  private async signOut() {
    try {
      const { error } = await AuthService.signOut();
      if (error) {
        console.error('Sign out error:', error);
        alert('Error signing out. Please try again.');
      }
      // The auth state listener will handle updating the UI
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  }

  public destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.authModal.destroy();
  }
}