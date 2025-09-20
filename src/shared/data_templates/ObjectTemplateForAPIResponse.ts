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
      try {
        if (Array.isArray(data)) {
          ObjectTemplateForAPIResponseGeneral.data.recordsCount = data.length;
        } else if (data?.applications && Array.isArray(data.applications)) {
          ObjectTemplateForAPIResponseGeneral.data.recordsCount = data.applications.length;
        } else if (data?.documents && Array.isArray(data.documents)) {
          ObjectTemplateForAPIResponseGeneral.data.recordsCount = data.documents.length;
        } else if (typeof data === 'object') {
          ObjectTemplateForAPIResponseGeneral.data.recordsCount = Object.keys(data).length;
        }
      } catch {
      }
    }
    if (message)
      ObjectTemplateForAPIResponseGeneral.message =
        message;

    return ObjectTemplateForAPIResponseGeneral;
  };
