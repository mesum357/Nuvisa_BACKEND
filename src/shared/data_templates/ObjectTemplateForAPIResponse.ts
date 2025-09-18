export const ObjectTemplateForAPIResponseGeneral =
  {
    status: '',
    data: {
      results: {},
      recordsCount: 0,
    },
    message: '',
  };

export const GetObjectTemplateForAPIResponseGeneral =
  (
    status: string,
    data: any,
    message: string,
  ): typeof ObjectTemplateForAPIResponseGeneral => {
     ObjectTemplateForAPIResponseGeneral.data.results = {};
    ObjectTemplateForAPIResponseGeneral.data.recordsCount = 0;
    ObjectTemplateForAPIResponseGeneral.message = '';
    ObjectTemplateForAPIResponseGeneral.status =
      status;

    if (data) {
      ObjectTemplateForAPIResponseGeneral.data.results =
        data;
      ObjectTemplateForAPIResponseGeneral.data.recordsCount =
        data.length;
    }
    if (message)
      ObjectTemplateForAPIResponseGeneral.message =
        message;

    return ObjectTemplateForAPIResponseGeneral;
  };
