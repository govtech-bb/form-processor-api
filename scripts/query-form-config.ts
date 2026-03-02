import { dataSource } from '../src/database/datasource';
import { FormConfig } from '../src/database/entities';

async function queryFormConfig() {
  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Connected!\n');

    const formConfigRepo = dataSource.getRepository(FormConfig);

    // Query for birth certificate admin email
    const birthCertConfig = await formConfigRepo.findOne({
      where: {
        formId: 'get-birth-certificate',
        key: 'admin_email',
      },
    });

    console.log('=== Birth Certificate Configuration ===');
    if (birthCertConfig) {
      console.log(`Form ID: ${birthCertConfig.formId}`);
      console.log(`Key: ${birthCertConfig.key}`);
      console.log(`Value: ${birthCertConfig.value}`);
      console.log(`Description: ${birthCertConfig.description || 'N/A'}`);
    } else {
      console.log('No configuration found for get-birth-certificate admin_email');
    }

    console.log('\n=== All Birth Certificate Configurations ===');
    const allBirthConfigs = await formConfigRepo.find({
      where: {
        formId: 'get-birth-certificate',
      },
    });

    if (allBirthConfigs.length > 0) {
      allBirthConfigs.forEach((config) => {
        console.log(`  ${config.key}: ${config.value}`);
      });
    } else {
      console.log('No configurations found for get-birth-certificate');
    }

    console.log('\n=== All Form Configurations (Summary) ===');
    const allConfigs = await formConfigRepo.find();
    const groupedByForm = allConfigs.reduce((acc, config) => {
      if (!acc[config.formId]) {
        acc[config.formId] = [];
      }
      acc[config.formId].push(config);
      return acc;
    }, {} as Record<string, FormConfig[]>);

    Object.keys(groupedByForm).forEach((formId) => {
      console.log(`\n${formId}:`);
      groupedByForm[formId].forEach((config) => {
        console.log(`  ${config.key}: ${config.value}`);
      });
    });

    await dataSource.destroy();
    console.log('\n\nDatabase connection closed.');
  } catch (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  }
}

queryFormConfig();
