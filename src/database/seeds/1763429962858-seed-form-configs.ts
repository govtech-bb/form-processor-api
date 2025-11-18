import { DataSource } from 'typeorm';
import { FormConfig } from '../entities';

export class SeedFormConfigs1763429962858 {
  public async up(dataSource: DataSource): Promise<void> {
    const repository = dataSource.getRepository(FormConfig);

    const seedData = [
      {
        formId: 'simple-feedback-form',
        key: 'admin_email',
        value: 'feedback@alpha.gov.bb',
        description: 'Admin email for feedback form submissions',
      },
      {
        formId: 'register-birth-form',
        key: 'admin_email',
        value: 'births@registrar.gov.bb',
        description: 'Admin email for birth registration submissions',
      },
    ];

    for (const data of seedData) {
      const exists = await repository.findOne({
        where: { formId: data.formId, key: data.key },
      });

      if (!exists) {
        await repository.save(data);
      }
    }
  }

  public async down(dataSource: DataSource): Promise<void> {
    const repository = dataSource.getRepository(FormConfig);
    await repository.delete({});
  }
}
