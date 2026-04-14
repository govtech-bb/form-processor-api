import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('feature_flag_audit_log')
export class FeatureFlagAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'service_slug', type: 'varchar', length: 255 })
  serviceSlug: string;

  /** null for service-level toggles */
  @Column({ name: 'subpage_slug', type: 'varchar', length: 255, nullable: true })
  subpageSlug: string | null;

  /** "service" for service-level toggles, "subpage" for subpage-level */
  @Column({ type: 'varchar', length: 20 })
  scope: 'service' | 'subpage';

  /** "enable" when flag was turned on, "disable" when turned off */
  @Column({ type: 'varchar', length: 20 })
  action: 'enable' | 'disable';

  @Index()
  @Column({ name: 'performed_by', type: 'varchar', length: 255 })
  performedBy: string;

  /** Human-readable display name supplied by the client (from ID token profile). */
  @Column({ name: 'performed_by_name', type: 'varchar', length: 255, nullable: true })
  performedByName: string | null;

  @Index()
  @CreateDateColumn({ name: 'performed_at', type: 'timestamptz' })
  performedAt: Date;
}
