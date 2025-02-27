import React from 'react';
import ApiKeyTable from '@/components/support/apikey/Table';
import { useTranslation } from 'next-i18next';
import { Box } from '@chakra-ui/react';
import AccountContainer, { TabEnum } from '@/pageComponents/account/AccountContainer';
import { serviceSideProps } from '@fastgpt/web/common/system/nextjs';

const ApiKey = () => {
  const { t } = useTranslation();
  return (
    <AccountContainer>
      <Box px={[4, 8]} py={[4, 6]}>
        <ApiKeyTable tips={t('account_apikey:key_tips')}></ApiKeyTable>
      </Box>
    </AccountContainer>
  );
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content, ['account_apikey', 'account', 'publish']))
    }
  };
}

export default ApiKey;
