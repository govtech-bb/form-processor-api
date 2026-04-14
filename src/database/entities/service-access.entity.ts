import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores protection config at two levels of granularity:
 *
 *   subpageSlug = ''      → service-level row; controls category listing visibility
 *   subpageSlug = 'form'  → subpage-level row; controls access to that specific subpage
 *
 * Absence of a row defaults to unprotected (fail open).
 */
@Entity('feature_flags')
@Index(['serviceSlug', 'subpageSlug'], { unique: true })
export class ServiceAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Matches the page slug in the frontend content directory (e.g. "register-a-birth") */
  @Column({ name: 'service_slug', type: 'varchar', length: 255 })
  serviceSlug: string;

  /**
   * The subpage slug this row applies to (e.g. "start", "form").
   * Empty string is the sentinel for a service-level row.
   */
  @Column({ name: 'subpage_slug', type: 'varchar', length: 255, default: '' })
  subpageSlug: string;

  @Column({ name: 'is_protected', default: false })
  isProtected: boolean;

  /** Optional note explaining why this entry is protected */
  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
